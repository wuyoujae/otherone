# Prisma Migration Guide

## Prerequisites

- PostgreSQL running locally or remotely
- `DATABASE_URL` configured in `server/.env`

## Steps

### 1. Initial Setup

```bash
cd server
cp .env.example .env
# Edit .env with your actual database credentials
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Create and Run Migrations

```bash
# Create a new migration after editing schema.prisma
npx prisma migrate dev --name <migration_name>

# Apply migrations in production
npx prisma migrate deploy
```

### 4. View Database (Development)

```bash
npx prisma studio
```

## Workflow

1. Edit `prisma/db.sql` (source of truth)
2. Sync changes to `prisma/schema.prisma`
3. Run `npx prisma migrate dev --name <description>`
4. Verify with `npx prisma studio`

## Migration History

### add-plugin-tables (2026-03-17)

Added tables for the plugin module system:

- `todo_item` — stores task/todo items for the Todo plugin
- `kb_article` — stores knowledge base articles for the Knowledge Base plugin

To apply this migration:

```bash
cd server
npx prisma migrate dev --name add-plugin-tables
```

This migration is safe for existing data — both tables are new and independent.

### add-craft-node-table (2026-03-17)

Added `craft_node` table for the Craft plugin file/directory tree system:

- `craft_node` — stores files (.craft) and directories (.module) in a hierarchical tree structure
- Each node has `parent_id` for nesting, `node_type` (1=file, 2=directory), and `content` (markdown for files)
- The legacy `craft` table is preserved for backward compatibility

```bash
cd server
npx prisma migrate dev --name add-craft-node-table
```
