"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const SCHEMA_VERSION = '20260318011754';
const MIGRATION_STATEMENTS = [
    {
        name: 'create-meta-table',
        sql: `
      CREATE TABLE IF NOT EXISTS "_otherone_meta" (
        "key" VARCHAR(100) PRIMARY KEY,
        "value" TEXT NOT NULL,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    },
    {
        name: 'create-user-table',
        sql: `
      CREATE TABLE IF NOT EXISTS "user" (
        "id" UUID NOT NULL,
        "display_name" VARCHAR(100) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "avatar_url" VARCHAR(500),
        "github_id" VARCHAR(100),
        "status" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "user_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "user_email_key" ON "user"("email");
      CREATE UNIQUE INDEX IF NOT EXISTS "user_github_id_key" ON "user"("github_id");
    `,
    },
    {
        name: 'create-project-table',
        sql: `
      CREATE TABLE IF NOT EXISTS "project" (
        "id" UUID NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "tag" VARCHAR(100),
        "icon" VARCHAR(50) NOT NULL DEFAULT 'Box',
        "status" INTEGER NOT NULL DEFAULT 0,
        "user_id" UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "project_pkey" PRIMARY KEY ("id")
      );
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "ai_agent_name" VARCHAR(100);
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "ai_status" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "ai_status_text" VARCHAR(500);
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "system_prompt" TEXT;
    `,
    },
    {
        name: 'create-project-member-table',
        sql: `
      CREATE TABLE IF NOT EXISTS "project_member" (
        "id" UUID NOT NULL,
        "project_id" UUID NOT NULL,
        "user_id" UUID,
        "member_type" INTEGER NOT NULL,
        "display_label" VARCHAR(50) NOT NULL,
        "role" INTEGER NOT NULL DEFAULT 3,
        "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "project_member_pkey" PRIMARY KEY ("id")
      );
    `,
    },
    {
        name: 'create-craft-table',
        sql: `
      CREATE TABLE IF NOT EXISTS "craft" (
        "id" UUID NOT NULL,
        "project_id" UUID NOT NULL,
        "title" VARCHAR(500),
        "content" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "craft_pkey" PRIMARY KEY ("id")
      );
      ALTER TABLE "craft" ADD COLUMN IF NOT EXISTS "content" TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS "craft_project_id_key" ON "craft"("project_id");
    `,
    },
    {
        name: 'create-craft-node-table',
        sql: `
      CREATE TABLE IF NOT EXISTS "craft_node" (
        "id" UUID NOT NULL,
        "project_id" UUID NOT NULL,
        "parent_id" UUID,
        "name" VARCHAR(255) NOT NULL,
        "node_type" INTEGER NOT NULL,
        "content" TEXT,
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "created_by" UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "craft_node_pkey" PRIMARY KEY ("id")
      );
    `,
    },
    {
        name: 'create-todo-module-table',
        sql: `
      CREATE TABLE IF NOT EXISTS "todo_module" (
        "id" UUID NOT NULL,
        "project_id" UUID NOT NULL,
        "parent_id" UUID,
        "name" VARCHAR(255) NOT NULL,
        "color" VARCHAR(20),
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "created_by" UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "todo_module_pkey" PRIMARY KEY ("id")
      );
    `,
    },
    {
        name: 'create-todo-item-table',
        sql: `
      CREATE TABLE IF NOT EXISTS "todo_item" (
        "id" UUID NOT NULL,
        "project_id" UUID NOT NULL,
        "title" VARCHAR(500) NOT NULL,
        "description" TEXT,
        "status" INTEGER NOT NULL DEFAULT 1,
        "priority" INTEGER NOT NULL DEFAULT 2,
        "assignee_id" UUID,
        "due_date" TIMESTAMPTZ,
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "created_by" UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "todo_item_pkey" PRIMARY KEY ("id")
      );
      ALTER TABLE "todo_item" ADD COLUMN IF NOT EXISTS "module_id" UUID;
      ALTER TABLE "todo_item" ADD COLUMN IF NOT EXISTS "content" TEXT;
      ALTER TABLE "todo_item" ADD COLUMN IF NOT EXISTS "start_date" DATE;
      ALTER TABLE "todo_item" ADD COLUMN IF NOT EXISTS "end_date" DATE;
      ALTER TABLE "todo_item" ADD COLUMN IF NOT EXISTS "start_time" VARCHAR(5);
      ALTER TABLE "todo_item" ADD COLUMN IF NOT EXISTS "end_time" VARCHAR(5);
    `,
    },
    {
        name: 'create-kb-article-table',
        sql: `
      CREATE TABLE IF NOT EXISTS "kb_article" (
        "id" UUID NOT NULL,
        "project_id" UUID NOT NULL,
        "title" VARCHAR(500) NOT NULL,
        "content" TEXT,
        "category" VARCHAR(100),
        "status" INTEGER NOT NULL DEFAULT 0,
        "file_url" VARCHAR(1000),
        "file_type" VARCHAR(50),
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "created_by" UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "kb_article_pkey" PRIMARY KEY ("id")
      );
    `,
    },
];
async function ensureSchema() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required for schema upgrade');
    }
    const client = new pg_1.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15000 });
    await client.connect();
    try {
        for (const step of MIGRATION_STATEMENTS) {
            console.log(`[db-upgrade] Applying step: ${step.name}`);
            await client.query('BEGIN');
            try {
                await client.query(step.sql);
                await client.query('COMMIT');
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }
        await client.query(`
        INSERT INTO "_otherone_meta" ("key", "value", "updated_at")
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT ("key")
        DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = CURRENT_TIMESTAMP
      `, ['schema_version', SCHEMA_VERSION]);
        console.log(`[db-upgrade] Schema is ready at version ${SCHEMA_VERSION}`);
    }
    finally {
        await client.end();
    }
}
ensureSchema().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(`[db-upgrade] Failed: ${message}`);
    process.exitCode = 1;
});
//# sourceMappingURL=ensure-schema.js.map