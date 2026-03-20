export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  runtimeConfig?: {
    apiBaseUrl: string | null;
  };
  send: (channel: string, data: unknown) => void;
  invoke: (channel: string, data?: unknown) => Promise<unknown>;
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

export interface LogDirectoryConfig {
  directory: string;
  isDefault: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
