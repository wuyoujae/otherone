import { ipcMain, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { readConfig, writeConfig } from './config-store';

type UpdateStatusType =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateStatusPayload {
  status: UpdateStatusType;
  version?: string;
  percent?: number;
  error?: string;
}

function broadcastStatus(payload: UpdateStatusPayload): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('app-update:status', payload);
    }
  });
}

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    broadcastStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    broadcastStatus({ status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    broadcastStatus({ status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcastStatus({
      status: 'downloading',
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    broadcastStatus({ status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err: Error) => {
    broadcastStatus({ status: 'error', error: err.message });
  });

  // IPC: manual check
  ipcMain.on('app-update:check', () => {
    autoUpdater.checkForUpdates().catch(() => {
      // error event will fire
    });
  });

  // IPC: download
  ipcMain.on('app-update:download', () => {
    autoUpdater.downloadUpdate().catch(() => {
      // error event will fire
    });
  });

  // IPC: restart and install
  ipcMain.on('app-update:restart', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // IPC: toggle auto-check
  ipcMain.on('app-update:toggle-auto', (_event, data: { enabled: boolean }) => {
    const enabled = data?.enabled ?? true;
    writeConfig('autoCheckUpdates', enabled);
  });

  // IPC: get current app version
  ipcMain.handle('app-update:get-version', () => {
    return autoUpdater.currentVersion.version;
  });

  // IPC: get auto-update config
  ipcMain.handle('app-update:get-config', () => {
    const config = readConfig();
    return { autoCheckUpdates: config.autoCheckUpdates };
  });
}

export function checkForUpdatesOnLaunch(): void {
  const config = readConfig();
  if (!config.autoCheckUpdates) return;

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // silently fail on launch check
    });
  }, 5000);
}
