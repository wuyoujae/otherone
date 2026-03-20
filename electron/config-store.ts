import { app, safeStorage } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

type AuthSession = {
  token: string | null;
  user: Record<string, unknown> | null;
};

type DatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

interface RawAppConfig {
  floatingBallEnabled: boolean;
  floatingBallPosition: { x: number; y: number } | null;
  autoCheckUpdates: boolean;
  logDirectory: string | null;
  authSession: AuthSession | null;
  authSessionEncrypted: string | null;
  databaseConfig: DatabaseConfig | null;
  databaseConfigEncrypted: string | null;
  securityPasswordHash: string | null;
  securityPasswordSalt: string | null;
}

interface AppConfig {
  floatingBallEnabled: boolean;
  floatingBallPosition: { x: number; y: number } | null;
  autoCheckUpdates: boolean;
  logDirectory: string | null;
  authSession: AuthSession | null;
  databaseConfig: DatabaseConfig | null;
  securityPasswordConfigured: boolean;
}

const DEFAULT_RAW_CONFIG: RawAppConfig = {
  floatingBallEnabled: false,
  floatingBallPosition: null,
  autoCheckUpdates: true,
  logDirectory: null,
  authSession: null,
  authSessionEncrypted: null,
  databaseConfig: null,
  databaseConfigEncrypted: null,
  securityPasswordHash: null,
  securityPasswordSalt: null,
};

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'otherone-config.json');
}

function readRawConfig(): RawAppConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_RAW_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_RAW_CONFIG };
  }
}

function writeRawConfig(config: RawAppConfig): void {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    // Silently fail if write is not possible
  }
}

function encodeEncrypted(value: string): string {
  return safeStorage.encryptString(value).toString('base64');
}

function decodeEncrypted(value: string): string {
  return safeStorage.decryptString(Buffer.from(value, 'base64'));
}

function canUseEncryption(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptJson<T>(value: T): { encrypted: string | null; plain: T | null } {
  const payload = JSON.stringify(value);
  if (canUseEncryption()) {
    return { encrypted: encodeEncrypted(payload), plain: null };
  }
  return { encrypted: null, plain: value };
}

function decryptJson<T>(encrypted: string | null, plain: T | null): T | null {
  if (encrypted) {
    try {
      return JSON.parse(decodeEncrypted(encrypted)) as T;
    } catch {
      return null;
    }
  }
  return plain;
}

function buildAppConfig(raw: RawAppConfig): AppConfig {
  return {
    floatingBallEnabled: raw.floatingBallEnabled,
    floatingBallPosition: raw.floatingBallPosition,
    autoCheckUpdates: raw.autoCheckUpdates,
    logDirectory: raw.logDirectory,
    authSession: decryptJson<AuthSession>(raw.authSessionEncrypted, raw.authSession),
    databaseConfig: decryptJson<DatabaseConfig>(raw.databaseConfigEncrypted, raw.databaseConfig),
    securityPasswordConfigured: Boolean(raw.securityPasswordHash && raw.securityPasswordSalt),
  };
}

export function readConfig(): AppConfig {
  return buildAppConfig(readRawConfig());
}

export function writeConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  const raw = readRawConfig();

  if (key === 'databaseConfig') {
    const nextValue = value as AppConfig['databaseConfig'];
    const encrypted = nextValue ? encryptJson(nextValue) : { encrypted: null, plain: null };
    raw.databaseConfigEncrypted = encrypted.encrypted;
    raw.databaseConfig = encrypted.plain;
    writeRawConfig(raw);
    return;
  }

  if (key === 'authSession') {
    const nextValue = value as AppConfig['authSession'];
    const encrypted = nextValue ? encryptJson(nextValue) : { encrypted: null, plain: null };
    raw.authSessionEncrypted = encrypted.encrypted;
    raw.authSession = encrypted.plain;
    writeRawConfig(raw);
    return;
  }

  if (key === 'securityPasswordConfigured') {
    return;
  }

  (raw as unknown as Record<string, unknown>)[key as string] = value;
  writeRawConfig(raw);
}

function hashSecurityPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function setSecurityPassword(password: string): void {
  const raw = readRawConfig();
  const salt = crypto.randomBytes(16).toString('hex');
  raw.securityPasswordSalt = salt;
  raw.securityPasswordHash = hashSecurityPassword(password, salt);
  writeRawConfig(raw);
}

export function verifySecurityPassword(password: string): boolean {
  const raw = readRawConfig();
  if (!raw.securityPasswordHash || !raw.securityPasswordSalt) {
    return false;
  }
  return hashSecurityPassword(password, raw.securityPasswordSalt) === raw.securityPasswordHash;
}

export function clearSecurityPassword(): void {
  const raw = readRawConfig();
  raw.securityPasswordHash = null;
  raw.securityPasswordSalt = null;
  writeRawConfig(raw);
}

export function getStoredDatabaseConfig(): DatabaseConfig | null {
  return readConfig().databaseConfig;
}

export function getStoredAuthSession(): AuthSession | null {
  return readConfig().authSession;
}

export type { AppConfig, AuthSession, DatabaseConfig };
