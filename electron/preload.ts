import { contextBridge, ipcRenderer } from 'electron';

const allowedSendChannels: string[] = [
  'floating-ball:toggle',
  'floating-ball:resize',
  'floating-ball:position-save',
  'app-update:check',
  'app-update:download',
  'app-update:restart',
  'app-update:toggle-auto',
];
const allowedReceiveChannels: string[] = [
  'floating-ball:toggled',
  'floating-ball:brightness',
  'floating-ball:layout',
  'app-update:status',
];
const allowedInvokeChannels: string[] = [
  'floating-ball:sample-brightness',
  'app-update:get-version',
  'app-update:get-config',
  'app-config:save-database',
  'logs:get-config',
  'logs:select-directory',
  'logs:reset-directory',
  'logs:open-directory',
];

const runtimeConfig = ipcRenderer.sendSync('app-config:get-runtime-sync');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  runtimeConfig,
  send: (channel: string, data: unknown) => {
    if (allowedSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  invoke: async (channel: string, data?: unknown): Promise<unknown> => {
    if (allowedInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return null;
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (allowedReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  removeAllListeners: (channel: string) => {
    if (allowedReceiveChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});
