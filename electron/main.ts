import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as net from 'net';
import * as crypto from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import { readConfig, setSecurityPassword, verifySecurityPassword, writeConfig } from './config-store';
import {
  createFloatingBallWindow,
  destroyFloatingBallWindow,
  hideFloatingBallWindow,
  isFloatingBallExpanded,
  showFloatingBallWindow,
  resizeFloatingBallWindow,
} from './floating-ball';
import { setupAutoUpdater, checkForUpdatesOnLaunch } from './auto-updater';
import {
  attachWindowLogging,
  logError,
  logInfo,
  registerLogIPC,
  setupProcessLogging,
} from './logger';

const isDev = !app.isPackaged;
const DEV_SERVER_URL = process.env.NEXT_DEV_URL || 'http://localhost:3002';
const DEV_API_BASE_URL = process.env.OTHERONE_API_BASE_URL || 'http://127.0.0.1:3003/api';

let mainWindow: BrowserWindow | null = null;
let appServerProcess: ChildProcess | null = null;
let apiServerProcess: ChildProcess | null = null;
let appBaseUrl = DEV_SERVER_URL;
let apiBaseUrl = DEV_API_BASE_URL;
const INTERNAL_PASSWORD_RESET_TOKEN = crypto.randomUUID();
let bootstrapState = {
  databaseConfigured: false,
  databasePasswordStored: false,
  databaseConnected: false,
  databaseSchemaReady: false,
  securityPasswordConfigured: false,
  hasAuthSession: false,
  needsSetup: true,
  lastDatabaseError: '',
};

function refreshBootstrapState(): void {
  const config = readConfig();
  bootstrapState = {
    ...bootstrapState,
    databaseConfigured: Boolean(config.databaseConfig),
    databasePasswordStored: Boolean(config.databaseConfig?.password),
    securityPasswordConfigured: config.securityPasswordConfigured,
    hasAuthSession: Boolean(config.authSession?.token),
    needsSetup:
      !config.databaseConfig ||
      !config.databaseConfig.password ||
      !config.securityPasswordConfigured ||
      !bootstrapState.databaseConnected ||
      !bootstrapState.databaseSchemaReady,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDatabaseSchemaUpgrade(serverCwd: string, databaseUrl: string): Promise<void> {
  const upgradeEntry = path.join(serverCwd, 'scripts', 'ensure-schema.js');
  const recentOutput: string[] = [];
  const nodePath = buildNodePath(
    path.join(serverCwd, '..', 'node_modules'),
    path.join(process.resourcesPath, 'app.asar', 'node_modules'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules'),
  );

  logInfo('db-upgrade', 'Running database schema upgrade', { upgradeEntry });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [upgradeEntry], {
      cwd: serverCwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        DATABASE_URL: databaseUrl,
        NODE_PATH: nodePath,
      },
      stdio: 'pipe',
    });

    const capture = (chunk: Buffer | string, isError = false) => {
      const message = chunk.toString().trim();
      if (!message) {
        return;
      }

      recentOutput.push(message);
      if (recentOutput.length > 20) {
        recentOutput.shift();
      }

      if (isError) {
        logError('db-upgrade', message);
      } else {
        logInfo('db-upgrade', message);
      }
    };

    child.stdout?.on('data', (chunk) => capture(chunk));
    child.stderr?.on('data', (chunk) => capture(chunk, true));

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const details = recentOutput.length > 0 ? ` Recent output: ${recentOutput[recentOutput.length - 1]}` : '';
      reject(new Error(`Database schema upgrade failed (code: ${code ?? 'unknown'}, signal: ${signal ?? 'none'}).${details}`));
    });
  });
}

async function findAvailablePort(startPort = 3002): Promise<number> {
  const maxAttempts = 20;

  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const isAvailable = await new Promise<boolean>((resolve) => {
      const server = net.createServer();

      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });

      server.listen(port, '127.0.0.1');
    });

    if (isAvailable) {
      return port;
    }
  }

  throw new Error(`No available port found starting from ${startPort}`);
}

function buildNodePath(...extraEntries: Array<string | undefined>): string {
  const existingNodePath = process.env.NODE_PATH;
  const entries = [
    ...extraEntries,
    existingNodePath,
  ].filter((entry): entry is string => Boolean(entry));

  return Array.from(new Set(entries)).join(path.delimiter);
}

function formatServerExitMessage(serverProcess: ChildProcess, recentServerOutput: string[]): string {
  const output = recentServerOutput.length > 0
    ? ` Recent server output: ${recentServerOutput[recentServerOutput.length - 1]}`
    : '';

  return `Embedded app server exited before becoming ready (code: ${serverProcess.exitCode ?? 'unknown'}, signal: ${serverProcess.signalCode ?? 'none'}).${output}`;
}

async function waitForEmbeddedServerReady(
  serverProcess: ChildProcess,
  url: string,
  recentServerOutput: string[],
  timeoutMs = 20000,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      throw new Error(formatServerExitMessage(serverProcess, recentServerOutput));
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await wait(250);
  }

  throw new Error(`Timed out waiting for app server at ${url}`);
}

function buildDatabaseUrl(): string | undefined {
  const config = readConfig().databaseConfig;
  if (!config) {
    return undefined;
  }

  const encodedPassword = encodeURIComponent(config.password);
  return `postgresql://${config.username}:${encodedPassword}@${config.host}:${config.port}/${config.database}`;
}

function getApiPortHint(): number {
  try {
    const parsed = new URL(apiBaseUrl);
    return Number(parsed.port) || 3003;
  } catch {
    return 3003;
  }
}

function createServerLogger(scope: string, recentServerOutput: string[]) {
  return (chunk: Buffer | string, isError = false) => {
    const message = chunk.toString().trim();
    if (!message) {
      return;
    }

    recentServerOutput.push(message);
    if (recentServerOutput.length > 10) {
      recentServerOutput.shift();
    }

    if (isError) {
      console.error(`[${scope}] ${message}`);
      logError(scope, message);
    } else {
      console.log(`[${scope}] ${message}`);
      logInfo(scope, message);
    }
  };
}

async function ensureApiBaseUrl(): Promise<string> {
  if (isDev) {
    return DEV_API_BASE_URL;
  }

  if (apiServerProcess && !apiServerProcess.killed) {
    return apiBaseUrl;
  }

  const serverEntry = path.join(process.resourcesPath, 'api-server', 'dist', 'server.js');
  const serverCwd = path.dirname(serverEntry);
  const recentServerOutput: string[] = [];
  const port = await findAvailablePort(getApiPortHint());
  const databaseUrl = buildDatabaseUrl();
  let databaseEnvUrl: string | undefined;
  const nodePath = buildNodePath(
    path.join(serverCwd, '..', 'node_modules'),
    path.join(process.resourcesPath, 'app.asar', 'node_modules'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules'),
  );

  apiBaseUrl = `http://127.0.0.1:${port}/api`;
  refreshBootstrapState();

  if (databaseUrl) {
    try {
      await runDatabaseSchemaUpgrade(serverCwd, databaseUrl);
      databaseEnvUrl = databaseUrl;
      bootstrapState.databaseConnected = true;
      bootstrapState.databaseSchemaReady = true;
      bootstrapState.lastDatabaseError = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      bootstrapState.databaseConnected = false;
      bootstrapState.databaseSchemaReady = false;
      bootstrapState.lastDatabaseError = message;
      logError('db-upgrade', 'Database bootstrap failed; falling back to setup mode', error);
    }
  } else {
    bootstrapState.databaseConnected = false;
    bootstrapState.databaseSchemaReady = false;
    bootstrapState.lastDatabaseError = bootstrapState.databaseConfigured
      ? 'Stored database configuration is incomplete. Please re-enter the database password.'
      : '';
    logInfo('db-upgrade', 'Skipping database schema upgrade because no database is configured');
  }
  refreshBootstrapState();

  logInfo('api-server', 'Starting embedded API server', { serverEntry, port, nodePath });

  apiServerProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverCwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      CORS_ORIGIN: appBaseUrl,
      NODE_PATH: nodePath,
      INTERNAL_PASSWORD_RESET_TOKEN,
      ...(databaseEnvUrl ? { DATABASE_URL: databaseEnvUrl } : {}),
    },
    stdio: 'pipe',
  });

  const logChunk = createServerLogger('api-server', recentServerOutput);
  apiServerProcess.stdout?.on('data', (chunk) => logChunk(chunk));
  apiServerProcess.stderr?.on('data', (chunk) => logChunk(chunk, true));

  apiServerProcess.once('exit', (code, signal) => {
    console.error('Embedded API server exited', { code, signal });
    logError('api-server', 'Embedded API server exited', { code, signal });
    apiServerProcess = null;
  });

  await waitForEmbeddedServerReady(apiServerProcess, `${apiBaseUrl}/health`, recentServerOutput);
  logInfo('api-server', 'Embedded API server is ready', { url: apiBaseUrl });
  return apiBaseUrl;
}

async function restartApiServer(): Promise<void> {
  if (apiServerProcess && !apiServerProcess.killed) {
    apiServerProcess.kill();
    apiServerProcess = null;
    await wait(500);
  }

  await ensureApiBaseUrl();
}

async function ensureAppBaseUrl(): Promise<string> {
  if (isDev) {
    return DEV_SERVER_URL;
  }

  if (appServerProcess && !appServerProcess.killed) {
    return appBaseUrl;
  }

  const serverEntry = path.join(process.resourcesPath, 'app', 'server.js');
  const serverCwd = path.dirname(serverEntry);
  const recentServerOutput: string[] = [];
  const port = await findAvailablePort();
  const nodePath = buildNodePath(
    path.join(serverCwd, 'node_modules'),
    path.join(process.resourcesPath, 'app.asar', 'node_modules'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules'),
  );

  appBaseUrl = `http://127.0.0.1:${port}`;
  await ensureApiBaseUrl();
  logInfo('next-server', 'Starting embedded Next.js server', { serverEntry, port, nodePath });

  appServerProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverCwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_PATH: nodePath,
      OTHERONE_API_BASE_URL: apiBaseUrl,
    },
    stdio: 'pipe',
  });

  const logChunk = createServerLogger('next-server', recentServerOutput);
  appServerProcess.stdout?.on('data', (chunk) => logChunk(chunk));
  appServerProcess.stderr?.on('data', (chunk) => logChunk(chunk, true));

  appServerProcess.once('exit', (code, signal) => {
    console.error(`Embedded app server exited`, { code, signal });
    logError('next-server', 'Embedded app server exited', { code, signal });
    appServerProcess = null;
  });

  await waitForEmbeddedServerReady(appServerProcess, appBaseUrl, recentServerOutput);
  logInfo('next-server', 'Embedded Next.js server is ready', { url: appBaseUrl });
  return appBaseUrl;
}

async function createWindow(): Promise<void> {
  const baseUrl = await ensureAppBaseUrl();
  const useCustomTitlebar = process.platform !== 'darwin';

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'OtherOne',
    backgroundColor: '#f4f4f5',
    autoHideMenuBar: useCustomTitlebar,
    frame: !useCustomTitlebar,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (useCustomTitlebar) {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setMenu(null);
  }

  attachWindowLogging(mainWindow, 'main');

  if (isDev) {
    mainWindow.loadURL(baseUrl);
  } else {
    mainWindow.loadURL(baseUrl);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Hide floating ball when main window is focused, show when blurred.
  // Delay the hide check to let floating-ball:resize IPC arrive first,
  // preventing a race condition where clicking the ball activates the main window.
  let hidePendingTimer: ReturnType<typeof setTimeout> | null = null;

  mainWindow.on('focus', () => {
    if (hidePendingTimer) clearTimeout(hidePendingTimer);
    hidePendingTimer = setTimeout(() => {
      if (!isFloatingBallExpanded()) {
        hideFloatingBallWindow();
      }
      hidePendingTimer = null;
    }, 150);
  });

  mainWindow.on('blur', () => {
    if (hidePendingTimer) { clearTimeout(hidePendingTimer); hidePendingTimer = null; }
    showFloatingBallWindow();
  });

  mainWindow.on('minimize', () => {
    if (hidePendingTimer) { clearTimeout(hidePendingTimer); hidePendingTimer = null; }
    showFloatingBallWindow();
  });

  const sendWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send('window:state', {
      isMaximized: mainWindow.isMaximized(),
    });
  };

  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);
  mainWindow.once('ready-to-show', sendWindowState);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for floating ball
function registerFloatingBallIPC(): void {
  ipcMain.on('floating-ball:toggle', (_event, data: { enabled: boolean }) => {
    const enabled = data?.enabled ?? false;
    writeConfig('floatingBallEnabled', enabled);

    if (enabled) {
      createFloatingBallWindow(appBaseUrl);
      // Hide immediately if main window is focused
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
        hideFloatingBallWindow();
      }
    } else {
      destroyFloatingBallWindow();
    }

    // Notify all renderer windows about the state change
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('floating-ball:toggled', { enabled });
      }
    });
  });

  ipcMain.on('floating-ball:resize', (_event, data: { expanded: boolean }) => {
    resizeFloatingBallWindow(data?.expanded ?? false);
  });

  ipcMain.on('floating-ball:position-save', (_event, data: { x: number; y: number }) => {
    if (data?.x !== undefined && data?.y !== undefined) {
      writeConfig('floatingBallPosition', { x: data.x, y: data.y });
    }
  });
}

function registerAppConfigIPC(): void {
  ipcMain.on('app-config:get-runtime-sync', (event) => {
    event.returnValue = {
      apiBaseUrl: isDev ? DEV_API_BASE_URL : apiBaseUrl,
    };
  });

  ipcMain.handle('app-config:save-database', async (_event, data: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  }) => {
    writeConfig('databaseConfig', data);

    if (!isDev) {
      await restartApiServer();
    }

    refreshBootstrapState();

    return { success: true };
  });

  ipcMain.handle('app-config:get-bootstrap', () => {
    refreshBootstrapState();
    return {
      ...bootstrapState,
      databaseConfig: readConfig().databaseConfig,
    };
  });

  ipcMain.handle('app-config:save-security-password', (_event, data: { password: string }) => {
    if (!data?.password || data.password.length < 6) {
      throw new Error('Security password must be at least 6 characters.');
    }
    setSecurityPassword(data.password);
    refreshBootstrapState();
    return { success: true };
  });

  ipcMain.handle('app-config:verify-security-password', (_event, data: { password: string }) => {
    return { success: verifySecurityPassword(data?.password ?? '') };
  });

  ipcMain.handle('app-auth:get-session', () => {
    return readConfig().authSession;
  });

  ipcMain.handle('app-auth:set-session', (_event, data: {
    token: string | null;
    user: Record<string, unknown> | null;
  }) => {
    const token = typeof data?.token === 'string' && data.token.length > 0 ? data.token : null;
    const user = data?.user && typeof data.user === 'object' ? data.user : null;
    writeConfig('authSession', { token, user });
    refreshBootstrapState();
    return { success: true };
  });

  ipcMain.handle('app-auth:clear-session', () => {
    writeConfig('authSession', null);
    refreshBootstrapState();
    return { success: true };
  });

  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }

    window.maximize();
  });

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle('window:get-state', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    return {
      isMaximized: window?.isMaximized() ?? false,
    };
  });

  ipcMain.handle('app-auth:reset-password', async (_event, data: {
    email: string;
    newPassword: string;
    securityPassword: string;
  }) => {
    if (!verifySecurityPassword(data?.securityPassword ?? '')) {
      throw new Error('Invalid security password.');
    }

    const baseUrl = await ensureApiBaseUrl();

    const response = await fetch(`${baseUrl}/auth/reset-password-local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-otherone-reset-token': INTERNAL_PASSWORD_RESET_TOKEN,
      },
      body: JSON.stringify({
        email: data.email,
        password: data.newPassword,
      }),
    });

    const payload = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || 'Failed to reset password.');
    }

    return { success: true };
  });
}

app.whenReady().then(() => {
  const boot = async () => {
    setupProcessLogging();
    registerFloatingBallIPC();
    registerAppConfigIPC();
    registerLogIPC();
    setupAutoUpdater();
    await createWindow();
    checkForUpdatesOnLaunch();

    // Restore floating ball if previously enabled (hidden initially since main window is focused)
    const config = readConfig();
    if (config.floatingBallEnabled) {
      createFloatingBallWindow(appBaseUrl);
      hideFloatingBallWindow();
    }
  };

  boot().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to boot desktop app', error);
    logError('app', 'Failed to boot desktop app', error);
    dialog.showErrorBox('Failed to start OtherOne', message);
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to recreate main window', error);
      logError('app', 'Failed to recreate main window', error);
      dialog.showErrorBox('Failed to reopen OtherOne', message);
    });
  }
});

app.on('before-quit', () => {
  if (appServerProcess && !appServerProcess.killed) {
    appServerProcess.kill();
    appServerProcess = null;
  }
  if (apiServerProcess && !apiServerProcess.killed) {
    apiServerProcess.kill();
    apiServerProcess = null;
  }
});
