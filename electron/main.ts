import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as net from 'net';
import { spawn, type ChildProcess } from 'child_process';
import { readConfig, writeConfig } from './config-store';
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const nodePath = buildNodePath(
    path.join(serverCwd, '..', 'node_modules'),
    path.join(process.resourcesPath, 'app.asar', 'node_modules'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules'),
  );

  apiBaseUrl = `http://127.0.0.1:${port}/api`;
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
      ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
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

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'OtherOne',
    backgroundColor: '#f4f4f5',
    autoHideMenuBar: process.platform === 'win32',
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

  if (process.platform === 'win32') {
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
