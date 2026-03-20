import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions, type WebContents } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { readConfig, writeConfig } from './config-store';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogDirectoryConfig {
  directory: string;
  isDefault: boolean;
}

function getDefaultLogDirectory(): string {
  return path.join(app.getPath('userData'), 'logs');
}

export function getLogDirectory(): string {
  const configuredPath = readConfig().logDirectory?.trim();
  return configuredPath || getDefaultLogDirectory();
}

function ensureLogDirectoryExists(directory = getLogDirectory()): void {
  fs.mkdirSync(directory, { recursive: true });
}

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(getLogDirectory(), `otherone-${date}.log`);
}

function serializeMeta(meta?: unknown): string {
  if (meta === undefined) {
    return '';
  }

  if (meta instanceof Error) {
    return `${meta.name}: ${meta.message}\n${meta.stack ?? ''}`.trim();
  }

  try {
    return typeof meta === 'string' ? meta : JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

export function writeLog(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  const serializedMeta = serializeMeta(meta);
  const logLine = [
    `[${timestamp}] [${level}] [${scope}] ${message}`,
    serializedMeta ? `${serializedMeta}\n` : '',
  ].join('\n');

  try {
    ensureLogDirectoryExists();
    fs.appendFileSync(getLogFilePath(), `${logLine}\n`, 'utf-8');
  } catch (error) {
    console.error('Failed to write log file', error);
  }
}

export function logInfo(scope: string, message: string, meta?: unknown): void {
  writeLog('INFO', scope, message, meta);
}

export function logWarn(scope: string, message: string, meta?: unknown): void {
  writeLog('WARN', scope, message, meta);
}

export function logError(scope: string, message: string, meta?: unknown): void {
  writeLog('ERROR', scope, message, meta);
}

export function getLogDirectoryConfig(): LogDirectoryConfig {
  const configuredPath = readConfig().logDirectory?.trim();
  return {
    directory: configuredPath || getDefaultLogDirectory(),
    isDefault: !configuredPath,
  };
}

export async function selectLogDirectory(ownerWindow: BrowserWindow | null): Promise<LogDirectoryConfig | null> {
  const options: OpenDialogOptions = {
    title: 'Select log directory',
    defaultPath: getLogDirectory(),
    properties: ['openDirectory', 'createDirectory'],
  };
  let result;

  if (ownerWindow) {
    result = await dialog.showOpenDialog(ownerWindow, options);
  } else {
    result = await dialog.showOpenDialog(options);
  }

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const directory = result.filePaths[0];
  ensureLogDirectoryExists(directory);
  writeConfig('logDirectory', directory);
  logInfo('logger', 'Log directory updated', { directory });
  return getLogDirectoryConfig();
}

export function resetLogDirectory(): LogDirectoryConfig {
  writeConfig('logDirectory', null);
  const config = getLogDirectoryConfig();
  ensureLogDirectoryExists(config.directory);
  logInfo('logger', 'Log directory reset to default', { directory: config.directory });
  return config;
}

export async function openLogDirectory(): Promise<string> {
  const directory = getLogDirectory();
  ensureLogDirectoryExists(directory);
  return shell.openPath(directory);
}

export function registerLogIPC(): void {
  ipcMain.handle('logs:get-config', () => getLogDirectoryConfig());
  ipcMain.handle('logs:select-directory', (event) => {
    return selectLogDirectory(BrowserWindow.fromWebContents(event.sender));
  });
  ipcMain.handle('logs:reset-directory', () => resetLogDirectory());
  ipcMain.handle('logs:open-directory', async () => {
    const errorMessage = await openLogDirectory();
    return { success: errorMessage.length === 0, error: errorMessage || null };
  });
}

export function setupProcessLogging(): void {
  ensureLogDirectoryExists();
  logInfo('app', 'Logging initialized', getLogDirectoryConfig());

  process.on('uncaughtException', (error) => {
    logError('process', 'Uncaught exception', error);
  });

  process.on('unhandledRejection', (reason) => {
    logError('process', 'Unhandled rejection', reason);
  });

  app.on('child-process-gone', (_event, details) => {
    logError('app', 'Child process terminated unexpectedly', details);
  });
}

export function attachWindowLogging(window: BrowserWindow, name: string): void {
  const scope = `window:${name}`;

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logError(scope, 'Page failed to load', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
    });
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    logError(scope, 'Renderer process exited', details);
  });

  window.on('unresponsive', () => {
    logWarn(scope, 'Window became unresponsive');
  });
}

export function attachWebContentsLogging(webContents: WebContents, name: string): void {
  webContents.on('render-process-gone', (_event, details) => {
    logError(`webContents:${name}`, 'Renderer process exited', details);
  });
}
