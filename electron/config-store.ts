import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface AppConfig {
  floatingBallEnabled: boolean;
  floatingBallPosition: { x: number; y: number } | null;
  autoCheckUpdates: boolean;
  logDirectory: string | null;
  databaseConfig: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  } | null;
}

const DEFAULT_CONFIG: AppConfig = {
  floatingBallEnabled: false,
  floatingBallPosition: null,
  autoCheckUpdates: true,
  logDirectory: null,
  databaseConfig: null,
};

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'otherone-config.json');
}

export function readConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  const config = readConfig();
  config[key] = value;
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    // Silently fail if write is not possible
  }
}

export type { AppConfig };
