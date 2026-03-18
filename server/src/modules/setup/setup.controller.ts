import { Request, Response } from 'express';
import { Client } from 'pg';
import { execSync } from 'child_process';
import path from 'path';
import { sendSuccess, sendError } from '../../utils/response';
import prisma from '../../config/database';

interface DbConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

function buildConnectionString(params: DbConnectionParams): string {
  const encodedPassword = encodeURIComponent(params.password);
  return `postgresql://${params.username}:${encodedPassword}@${params.host}:${params.port}/${params.database}`;
}

export async function testDatabase(req: Request, res: Response): Promise<void> {
  const { host, port, username, password, database } = req.body as DbConnectionParams;

  if (!host || !port || !username || !database) {
    sendError(res, 'Missing required connection parameters', 400);
    return;
  }

  const connectionString = buildConnectionString({ host, port, username, password, database });
  const client = new Client({ connectionString, connectionTimeoutMillis: 8000 });

  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    const version = result.rows[0]?.version || 'Unknown';
    await client.end();

    sendSuccess(res, {
      connectionString,
      version,
    }, 'Database connection successful');
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

export async function checkTables(_req: Request, res: Response): Promise<void> {
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const tableNames = tables.map((t) => t.tablename);
    const requiredTables = ['user', 'project', 'project_member', 'craft', 'craft_node', 'todo_item', 'kb_article'];
    const allPresent = requiredTables.every((t) => tableNames.includes(t));

    sendSuccess(res, {
      initialized: allPresent,
      tables: tableNames,
      missing: requiredTables.filter((t) => !tableNames.includes(t)),
    });
  } catch {
    sendSuccess(res, { initialized: false, tables: [], missing: [] });
  }
}

export async function initDatabase(req: Request, res: Response): Promise<void> {
  const { connectionString } = req.body as { connectionString?: string };

  try {
    const prismaDir = path.resolve(__dirname, '../../../prisma');
    const envVars = {
      ...process.env,
      ...(connectionString ? { DATABASE_URL: connectionString } : {}),
    };

    execSync('npx prisma migrate deploy', {
      cwd: prismaDir,
      env: envVars,
      timeout: 30000,
      stdio: 'pipe',
    });

    sendSuccess(res, { initialized: true }, 'Database initialized successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Migration failed';
    sendError(res, message, 500);
  }
}
