import { Request, Response } from 'express';
import { Client } from 'pg';
import * as fs from 'fs';
import path from 'path';
import { sendSuccess, sendError } from '../../utils/response';
import prisma from '../../config/database';

interface DbConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
}

const REQUIRED_TABLES = ['user', 'project', 'project_member', 'craft', 'craft_node', 'todo_item', 'kb_article'];

function buildConnectionString(params: DbConnectionParams, databaseOverride?: string): string {
  const encodedPassword = encodeURIComponent(params.password);
  const database = databaseOverride ?? params.database ?? 'postgres';
  return `postgresql://${params.username}:${encodedPassword}@${params.host}:${params.port}/${database}`;
}

async function withClient<T>(connectionString: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString, connectionTimeoutMillis: 8000 });
  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function getExistingTables(params: DbConnectionParams): Promise<string[]> {
  if (!params.database) {
    return [];
  }

  try {
    return await withClient(buildConnectionString(params), async (client) => {
      const tables = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      );
      return tables.rows.map((row) => row.tablename);
    });
  } catch {
    return [];
  }
}

export async function testDatabase(req: Request, res: Response): Promise<void> {
  const { host, port, username, password } = req.body as DbConnectionParams;

  if (!host || !port || !username) {
    sendError(res, 'Missing required connection parameters', 400);
    return;
  }

  const connectionString = buildConnectionString({ host, port, username, password }, 'postgres');

  try {
    const version = await withClient(connectionString, async (client) => {
      const result = await client.query('SELECT version()');
      return result.rows[0]?.version || 'Unknown';
    });

    sendSuccess(res, { version }, 'Database connection successful');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown connection error';
    sendError(res, message, 400);
  }
}

export async function checkDatabase(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    sendSuccess(res, { connected: true });
  } catch {
    sendSuccess(res, { connected: false });
  }
}

export async function checkTables(req: Request, res: Response): Promise<void> {
  const params = req.method === 'POST'
    ? req.body as DbConnectionParams
    : null;

  if (params?.host && params?.port && params?.username && params?.database) {
    const tableNames = await getExistingTables(params);
    const allPresent = REQUIRED_TABLES.every((table) => tableNames.includes(table));

    sendSuccess(res, {
      initialized: allPresent,
      tables: tableNames,
      missing: REQUIRED_TABLES.filter((table) => !tableNames.includes(table)),
    });
    return;
  }

  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const tableNames = tables.map((t) => t.tablename);
    const allPresent = REQUIRED_TABLES.every((table) => tableNames.includes(table));

    sendSuccess(res, {
      initialized: allPresent,
      tables: tableNames,
      missing: REQUIRED_TABLES.filter((table) => !tableNames.includes(table)),
    });
  } catch {
    sendSuccess(res, { initialized: false, tables: [], missing: REQUIRED_TABLES });
  }
}

export async function initDatabase(req: Request, res: Response): Promise<void> {
  const params = req.body as DbConnectionParams;

  if (!params.host || !params.port || !params.username || !params.database) {
    sendError(res, 'Missing required database initialization parameters', 400);
    return;
  }

  const databaseName = params.database;
  const adminConnectionString = buildConnectionString(params, 'postgres');
  const targetConnectionString = buildConnectionString(params);

  try {
    await withClient(adminConnectionString, async (client) => {
      const existingDb = await client.query<{ datname: string }>(
        'SELECT datname FROM pg_database WHERE datname = $1',
        [databaseName],
      );

      if (existingDb.rowCount === 0) {
        await client.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
      }
    });

    const sqlFilePath = path.resolve(__dirname, '../../../prisma/db.sql');
    const rawSql = fs.readFileSync(sqlFilePath, 'utf-8');
    const normalizedSql = rawSql.replace(/CREATE TABLE\s+/g, 'CREATE TABLE IF NOT EXISTS ');

    await withClient(targetConnectionString, async (client) => {
      await client.query(normalizedSql);
    });

    const existingTables = await getExistingTables(params);
    const allPresent = REQUIRED_TABLES.every((table) => existingTables.includes(table));

    sendSuccess(res, {
      initialized: allPresent,
      databaseCreated: true,
      tables: existingTables,
    }, 'Database initialized successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database initialization failed';
    sendError(res, message, 500);
  }
}
