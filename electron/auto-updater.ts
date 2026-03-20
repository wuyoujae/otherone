import { ipcMain, BrowserWindow, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { readConfig, writeConfig } from './config-store';
import { logError, logInfo } from './logger';

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

interface ReleaseCandidate {
  version: string;
  tag: string;
  pageUrl: string;
  publishedAt?: string;
  downloadUrl: string | null;
}

const GITHUB_RELEASES_ATOM_URL = 'https://github.com/wuyoujae/otherone/releases.atom';
let latestReleaseCandidate: ReleaseCandidate | null = null;

function broadcastStatus(payload: UpdateStatusPayload): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('app-update:status', payload);
    }
  });
}

function getPlatformAssetMatchers(): RegExp[] {
  switch (process.platform) {
    case 'win32':
      return [/\.exe$/i];
    case 'darwin':
      return [/\.dmg$/i, /-mac\.zip$/i, /\.pkg$/i];
    case 'linux':
      return [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i, /\.snap$/i];
    default:
      return [];
  }
}

function parseVersion(version: string): number[] | null {
  const normalized = version.trim().replace(/^v/i, '').split('-')[0];
  const parts = normalized.split('.');

  if (parts.length < 3) {
    return null;
  }

  const parsed = parts.slice(0, 3).map((part) => Number(part));
  return parsed.every((part) => Number.isInteger(part) && part >= 0) ? parsed : null;
}

function isVersionGreater(candidate: string, current: string): boolean {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);

  if (!candidateParts || !currentParts) {
    throw new Error(`Unable to compare versions: current=${current}, latest=${candidate}`);
  }

  for (let i = 0; i < 3; i += 1) {
    if (candidateParts[i] > currentParts[i]) return true;
    if (candidateParts[i] < currentParts[i]) return false;
  }

  return false;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'OtherOne-Updater',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} for ${url}`);
  }

  return response.text();
}

function parseLatestReleaseFromAtom(feedXml: string): ReleaseCandidate {
  const entryMatch = feedXml.match(/<entry>([\s\S]*?)<\/entry>/i);
  if (!entryMatch) {
    throw new Error('No release entries found in GitHub Atom feed');
  }

  const entryXml = entryMatch[1];
  const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/i);
  const linkMatch = entryXml.match(/<link[^>]+href="([^"]+)"/i);
  const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/i);

  if (!titleMatch || !linkMatch) {
    throw new Error('Unable to parse latest release title or link from Atom feed');
  }

  const rawTag = titleMatch[1].trim();
  return {
    version: rawTag.replace(/^v/i, ''),
    tag: rawTag,
    pageUrl: linkMatch[1],
    publishedAt: updatedMatch?.[1],
    downloadUrl: null,
  };
}

async function resolvePlatformAssetUrl(releasePageUrl: string): Promise<string | null> {
  const expandedAssetsUrl = releasePageUrl.replace('/tag/', '/expanded_assets/');
  const html = await fetchText(expandedAssetsUrl);
  const urls = Array.from(
    html.matchAll(/href="([^"]*\/releases\/download\/[^"]+)"/gi),
    (match) => `https://github.com${match[1]}`,
  );

  if (urls.length === 0) {
    return null;
  }

  const dedupedUrls = Array.from(new Set(urls));
  const matchers = getPlatformAssetMatchers();

  for (const matcher of matchers) {
    const matchedUrl = dedupedUrls.find((url) => matcher.test(url));
    if (matchedUrl) {
      return matchedUrl;
    }
  }

  return null;
}

async function performUpdateCheck(): Promise<void> {
  latestReleaseCandidate = null;
  broadcastStatus({ status: 'checking' });
  logInfo('updater', 'Checking for updates', { feedUrl: GITHUB_RELEASES_ATOM_URL });

  try {
    const feedXml = await fetchText(GITHUB_RELEASES_ATOM_URL);
    const latestRelease = parseLatestReleaseFromAtom(feedXml);
    const currentVersion = autoUpdater.currentVersion.version;

    if (!isVersionGreater(latestRelease.version, currentVersion)) {
      broadcastStatus({ status: 'not-available' });
      logInfo('updater', 'No updates available', { currentVersion, latestVersion: latestRelease.version });
      return;
    }

    latestRelease.downloadUrl = await resolvePlatformAssetUrl(latestRelease.pageUrl);
    latestReleaseCandidate = latestRelease;

    broadcastStatus({ status: 'available', version: latestRelease.version });
    logInfo('updater', 'Update available', {
      currentVersion,
      latestVersion: latestRelease.version,
      pageUrl: latestRelease.pageUrl,
      downloadUrl: latestRelease.downloadUrl,
      publishedAt: latestRelease.publishedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    broadcastStatus({ status: 'error', error: message });
    logError('updater', 'Update flow failed', error);
  }
}

export function setupAutoUpdater(): void {
  // IPC: manual check
  ipcMain.on('app-update:check', () => {
    void performUpdateCheck();
  });

  // IPC: download
  ipcMain.on('app-update:download', () => {
    if (!latestReleaseCandidate) {
      broadcastStatus({ status: 'error', error: 'No update is ready to download. Please check for updates again.' });
      return;
    }

    const targetUrl = latestReleaseCandidate.downloadUrl ?? latestReleaseCandidate.pageUrl;
    shell.openExternal(targetUrl).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      broadcastStatus({ status: 'error', error: message });
      logError('updater', 'Failed to open update URL', error);
    });

    logInfo('updater', 'Opened update download target', {
      version: latestReleaseCandidate.version,
      targetUrl,
      hasDirectAsset: Boolean(latestReleaseCandidate.downloadUrl),
    });
  });

  // IPC: restart and install
  ipcMain.on('app-update:restart', () => {
    broadcastStatus({ status: 'error', error: 'Downloaded installers are opened externally. Please install the update manually.' });
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
    void performUpdateCheck();
  }, 5000);
}
