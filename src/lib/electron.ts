export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

export function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  return null;
}
