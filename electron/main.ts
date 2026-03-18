import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
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

const isDev = !app.isPackaged;
const DEV_SERVER_URL = process.env.NEXT_DEV_URL || 'http://localhost:3002';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'OtherOne',
    backgroundColor: '#f4f4f5',
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

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    // Production: load from built Next.js standalone server
    mainWindow.loadURL(DEV_SERVER_URL);
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
      createFloatingBallWindow(DEV_SERVER_URL);
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

app.whenReady().then(() => {
  registerFloatingBallIPC();
  setupAutoUpdater();
  createWindow();
  checkForUpdatesOnLaunch();

  // Restore floating ball if previously enabled (hidden initially since main window is focused)
  const config = readConfig();
  if (config.floatingBallEnabled) {
    createFloatingBallWindow(DEV_SERVER_URL);
    hideFloatingBallWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
