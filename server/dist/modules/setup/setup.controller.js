"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDatabase = testDatabase;
exports.checkDatabase = checkDatabase;
exports.checkTables = checkTables;
exports.initDatabase = initDatabase;
const pg_1 = require("pg");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const response_1 = require("../../utils/response");
const database_1 = __importDefault(require("../../config/database"));
const REQUIRED_TABLES = ['user', 'project', 'project_member', 'craft', 'craft_node', 'todo_item', 'kb_article'];
function buildConnectionString(params, databaseOverride) {
    const encodedPassword = encodeURIComponent(params.password);
    const database = databaseOverride ?? params.database ?? 'postgres';
    return `postgresql://${params.username}:${encodedPassword}@${params.host}:${params.port}/${database}`;
}
async function withClient(connectionString, fn) {
    const client = new pg_1.Client({ connectionString, connectionTimeoutMillis: 8000 });
    await client.connect();
    try {
        return await fn(client);
    }
    finally {
        await client.end();
    }
}
async function getExistingTables(params) {
    if (!params.database) {
        return [];
    }
    try {
        return await withClient(buildConnectionString(params), async (client) => {
            const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
            return tables.rows.map((row) => row.tablename);
        });
    }
    catch {
        return [];
    }
}
async function testDatabase(req, res) {
    const { host, port, username, password } = req.body;
    if (!host || !port || !username) {
        (0, response_1.sendError)(res, 'Missing required connection parameters', 400);
        return;
    }
    const connectionString = buildConnectionString({ host, port, username, password }, 'postgres');
    try {
        const version = await withClient(connectionString, async (client) => {
            const result = await client.query('SELECT version()');
            return result.rows[0]?.version || 'Unknown';
        });
        (0, response_1.sendSuccess)(res, { version }, 'Database connection successful');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown connection error';
        (0, response_1.sendError)(res, message, 400);
    }
}
async function checkDatabase(_req, res) {
    try {
        await database_1.default.$queryRaw `SELECT 1`;
        (0, response_1.sendSuccess)(res, { connected: true });
    }
    catch {
        (0, response_1.sendSuccess)(res, { connected: false });
    }
}
async function checkTables(req, res) {
    const params = req.method === 'POST'
        ? req.body
        : null;
    if (params?.host && params?.port && params?.username && params?.database) {
        const tableNames = await getExistingTables(params);
        const allPresent = REQUIRED_TABLES.every((table) => tableNames.includes(table));
        (0, response_1.sendSuccess)(res, {
            initialized: allPresent,
            tables: tableNames,
            missing: REQUIRED_TABLES.filter((table) => !tableNames.includes(table)),
        });
        return;
    }
    try {
        const tables = await database_1.default.$queryRaw `
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
        const tableNames = tables.map((t) => t.tablename);
        const allPresent = REQUIRED_TABLES.every((table) => tableNames.includes(table));
        (0, response_1.sendSuccess)(res, {
            initialized: allPresent,
            tables: tableNames,
            missing: REQUIRED_TABLES.filter((table) => !tableNames.includes(table)),
        });
    }
    catch {
        (0, response_1.sendSuccess)(res, { initialized: false, tables: [], missing: REQUIRED_TABLES });
    }
}
async function initDatabase(req, res) {
    const params = req.body;
    if (!params.host || !params.port || !params.username || !params.database) {
        (0, response_1.sendError)(res, 'Missing required database initialization parameters', 400);
        return;
    }
    const databaseName = params.database;
    const adminConnectionString = buildConnectionString(params, 'postgres');
    const targetConnectionString = buildConnectionString(params);
    try {
        await withClient(adminConnectionString, async (client) => {
            const existingDb = await client.query('SELECT datname FROM pg_database WHERE datname = $1', [databaseName]);
            if (existingDb.rowCount === 0) {
                await client.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
            }
        });
        const sqlFilePath = path_1.default.resolve(__dirname, '../../../prisma/db.sql');
        const rawSql = fs.readFileSync(sqlFilePath, 'utf-8');
        const normalizedSql = rawSql.replace(/CREATE TABLE\s+/g, 'CREATE TABLE IF NOT EXISTS ');
        await withClient(targetConnectionString, async (client) => {
            await client.query(normalizedSql);
        });
        const existingTables = await getExistingTables(params);
        const allPresent = REQUIRED_TABLES.every((table) => existingTables.includes(table));
        (0, response_1.sendSuccess)(res, {
            initialized: allPresent,
            databaseCreated: true,
            tables: existingTables,
        }, 'Database initialized successfully');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Database initialization failed';
        (0, response_1.sendError)(res, message, 500);
    }
}
//# sourceMappingURL=setup.controller.js.map