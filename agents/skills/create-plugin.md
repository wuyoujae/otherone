# Skill: Create Plugin Module

This document is the **authoritative guide** for any AI agent creating a new plugin module in the Beyond Code platform. Follow every step exactly. Do not skip, reorder, or improvise.

---

## Architecture Overview

```
                    ┌──────────────────────────────────────┐
                    │          Plugin Registry              │
                    │  (singleton, code-level config)       │
                    │                                       │
                    │  register() ── adds plugin            │
                    │  getAll()   ── returns all plugins    │
                    │  onProjectCreate() ── broadcasts hook │
                    │  onProjectDelete() ── broadcasts hook │
                    └──────────┬───────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────────┐
        │  craft   │    │   todo   │    │ knowledge-   │
        │  plugin  │    │  plugin  │    │ base plugin  │
        └──────────┘    └──────────┘    └──────────────┘
              │                │                │
              ▼                ▼                ▼
         /api/craft      /api/todo     /api/knowledge-base
```

### Key Design Decisions

- **Module registry = code-level config**, not a database table.
- **No `project_module` table**. All projects always have all modules.
- **Convention-based structure**. Every plugin follows the exact same directory and file pattern.
- **Lifecycle hooks**. `onProjectCreate` and `onProjectDelete` let each plugin manage its own data.

---

## What You Will Create

For a plugin named `{name}` (kebab-case, e.g. `timeline`, `code-review`, `test-runner`):

```
# Backend (8 touchpoints: 4 new files + 4 modifications)
server/src/plugins/{name}/
├── {name}.manifest.ts          # NEW  - plugin declaration
├── {name}.routes.ts            # NEW  - Express routes
├── {name}.controller.ts        # NEW  - request handlers
└── {name}.service.ts           # NEW  - business logic + DB

server/src/plugins/index.ts     # MODIFY - register the new plugin
server/prisma/db.sql            # MODIFY - add table (if plugin has data)
server/prisma/schema.prisma     # MODIFY - add Prisma model (if plugin has data)

# Frontend (4 touchpoints: 2 new files + 2 modifications)
src/lib/plugins/manifests/{name}.ts           # NEW  - frontend manifest
src/app/(project)/projects/[id]/{name}/
└── page.tsx                                  # NEW  - page component

src/lib/plugins/plugin-registry.ts            # MODIFY - import manifest + icon
src/i18n/locales/en.json                      # MODIFY - add i18n keys
src/i18n/locales/zh.json                      # MODIFY - add i18n keys
```

---

## Step-by-Step Procedure

### Step 0: Pre-flight Checks

Before writing any code:

1. Choose a **plugin ID** in kebab-case (e.g. `timeline`). This ID must be unique across all plugins.
2. Choose a **Lucide icon name** (e.g. `Clock`, `GitPullRequest`). Browse available icons at the Lucide icon set.
3. Decide if the plugin needs its own **database table**. If yes, design the schema following the rules in the next step.
4. Read existing plugin code (e.g. `server/src/plugins/todo/`) to calibrate your style.

---

### Step 1: Database (skip if plugin has no persistent data)

#### 1.1 Edit `server/prisma/db.sql`

Append your table definition at the bottom. **Mandatory rules:**

- Primary key: `id UUID PRIMARY KEY`
- Must include `project_id UUID NOT NULL` (logical relationship, **no FK constraint**)
- Must include `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Must include `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- All status/type fields use **integer enums**:
  - Binary states: `0` = normal, non-zero = abnormal
  - Multi-value categories: start from `1`
- If adding columns to an existing table, they **must be nullable**
- **No foreign key constraints. No triggers.**

**Template:**

```sql
-- {Human-readable description} (plugin: {name})
CREATE TABLE {table_name} (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    -- your columns here --
    status INT NOT NULL DEFAULT {default},
    sort_order INT NOT NULL DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 1.2 Edit `server/prisma/schema.prisma`

Add a Prisma model that mirrors the SQL table. Follow existing models for style:

```prisma
model YourModel {
  id        String   @id @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  // ... your fields, use @map("snake_case") for each ...
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt DateTime @default(now()) @map("updated_at") @db.Timestamptz()

  @@map("your_table_name")
}
```

**Field mapping rules:**
- TypeScript: `camelCase` --- SQL column: `snake_case` --- use `@map("snake_case")`
- `String` fields need `@db.VarChar(N)` or `@db.Text`
- `DateTime` fields need `@db.Timestamptz()`
- Optional fields use `?` suffix (e.g. `String?`)

#### 1.3 Run migration

```bash
cd server
npx prisma migrate dev --name add-{name}-plugin-table
```

#### 1.4 Update `server/prisma/usage.md`

Append a migration history entry documenting what was added and why.

---

### Step 2: Backend Service (`server/src/plugins/{name}/{name}.service.ts`)

This file contains **all database operations**. No HTTP concepts here (no `req`, `res`).

**Required exports:**

| Function | Purpose | When called |
|----------|---------|-------------|
| `delete{Items}ForProject(projectId)` | Cleanup on project delete | `onProjectDelete` hook |
| `init{Items}ForProject(projectId)` | Init data on project create (optional) | `onProjectCreate` hook |
| `get{Items}ByProjectId(projectId)` | List items | GET endpoint |
| `create{Item}(projectId, createdBy, data)` | Create item | POST endpoint |
| `update{Item}(itemId, data)` | Update item | PUT endpoint |
| `delete{Item}(itemId)` | Delete single item | DELETE endpoint |
| `get{Item}ById(itemId)` | Get single item (for ownership check) | Internal use |

**Template:**

```typescript
import crypto from 'crypto';
import prisma from '../../config/database';

// --- Lifecycle hooks ---

export async function delete{Items}ForProject(projectId: string): Promise<void> {
  await prisma.{model}.deleteMany({ where: { projectId } });
}

// Optional: only if the plugin needs initial data when a project is created
// export async function init{Items}ForProject(projectId: string): Promise<void> { ... }

// --- CRUD ---

export async function get{Items}ByProjectId(projectId: string) {
  return prisma.{model}.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function create{Item}(
  projectId: string,
  createdBy: string,
  data: { title: string; /* other fields */ },
) {
  const id = crypto.randomUUID();
  return prisma.{model}.create({
    data: {
      id,
      projectId,
      title: data.title,
      // ... map all fields, use `|| null` for optional fields ...
      createdBy,
      updatedAt: new Date(),
    },
  });
}

export async function update{Item}(
  itemId: string,
  data: { title?: string; /* other optional fields */ },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { updatedAt: new Date() };
  if (data.title !== undefined) updateData.title = data.title;
  // ... repeat for each updatable field ...

  return prisma.{model}.update({
    where: { id: itemId },
    data: updateData,
  });
}

export async function delete{Item}(itemId: string) {
  return prisma.{model}.delete({ where: { id: itemId } });
}

export async function get{Item}ById(itemId: string) {
  return prisma.{model}.findUnique({ where: { id: itemId } });
}
```

**Key rules:**
- All IDs are `crypto.randomUUID()`, generated immediately before INSERT.
- Always set `updatedAt: new Date()` on create and update.
- Optional fields default to `null`, not `undefined`.

---

### Step 3: Backend Controller (`server/src/plugins/{name}/{name}.controller.ts`)

Handles HTTP request/response. Each exported function follows the same pattern.

**Mandatory imports:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import * as {name}Service from './{name}.service';
import prisma from '../../config/database';
```

**Project access validation (copy this helper into every controller):**

```typescript
async function validateProjectAccess(req: Request, res: Response): Promise<string | null> {
  if (!req.user) { sendError(res, 'Authentication required', 401); return null; }

  const projectId = req.params.projectId as string;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) { sendError(res, 'Project not found', 404); return null; }
  if (project.userId !== req.user.userId) { sendError(res, 'Forbidden', 403); return null; }

  return projectId;
}
```

**Handler pattern (every handler follows this shape):**

```typescript
export async function get{Items}(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const items = await {name}Service.get{Items}ByProjectId(projectId);
    sendSuccess(res, items);
  } catch (error) {
    next(error);
  }
}
```

**Response utility signatures (do not guess these, use them exactly):**

```typescript
sendSuccess(res, data)                      // 200 with data
sendSuccess(res, data, undefined, 201)      // 201 Created (note: 3rd arg is message, not status)
sendSuccess(res, null)                      // 200 with null data (for delete)
sendError(res, 'Message', 400)              // error with status code
```

**For create handlers:** validate required fields before calling service:

```typescript
const { title } = req.body;
if (!title || typeof title !== 'string' || !title.trim()) {
  sendError(res, 'Title is required', 400);
  return;
}
```

**For update/delete handlers:** verify the item exists AND belongs to the project:

```typescript
const itemId = req.params.{itemId} as string;
const existing = await {name}Service.get{Item}ById(itemId);
if (!existing) { sendError(res, '{Item} not found', 404); return; }
if (existing.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }
```

---

### Step 4: Backend Routes (`server/src/plugins/{name}/{name}.routes.ts`)

**Template (standard CRUD):**

```typescript
import { Router } from 'express';
import { get{Items}, create{Item}, update{Item}, delete{Item} } from './{name}.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/:projectId', authenticate, get{Items});
router.post('/:projectId', authenticate, create{Item});
router.put('/:projectId/:{itemId}', authenticate, update{Item});
router.delete('/:projectId/:{itemId}', authenticate, delete{Item});

export default router;
```

**Rules:**
- Every route MUST use `authenticate` middleware.
- First path segment is always `:projectId`.
- Item-specific routes add `:{itemId}` as second segment.

---

### Step 5: Backend Manifest (`server/src/plugins/{name}/{name}.manifest.ts`)

```typescript
import { PluginManifest } from '../plugin.types';
import router from './{name}.routes';
import { delete{Items}ForProject } from './{name}.service';
// import { init{Items}ForProject } from './{name}.service'; // if needed

const {name}Manifest: PluginManifest = {
  id: '{name}',                    // must match frontend manifest id exactly
  routePrefix: '{name}',           // route mounted at /api/{name}
  router,
  version: '1.0.0',
  hooks: {
    // onProjectCreate: init{Items}ForProject,   // uncomment if plugin needs init data
    onProjectDelete: delete{Items}ForProject,
  },
};

export default {name}Manifest;
```

**PluginManifest interface (do not modify):**

```typescript
interface PluginManifest {
  id: string;              // unique key, kebab-case
  routePrefix: string;     // mounted at /api/{routePrefix}
  router: Router;          // Express Router instance
  version: string;         // semver
  hooks?: {
    onProjectCreate?: (projectId: string, userId: string) => Promise<void>;
    onProjectDelete?: (projectId: string) => Promise<void>;
  };
}
```

---

### Step 6: Register Backend Plugin

**Edit** `server/src/plugins/index.ts`:

1. Add import: `import {name}Manifest from './{name}/{name}.manifest';`
2. Add registration: `pluginRegistry.register({name}Manifest);`

After this single edit, the plugin is **fully operational** on the backend:
- Routes auto-mounted at `/api/{name}`
- Hooks auto-fire on project create/delete
- `GET /api/plugins` auto-includes the new plugin

---

### Step 7: Frontend Manifest (`src/lib/plugins/manifests/{name}.ts`)

```typescript
import { ModuleManifest } from '../plugin.types';

const {name}Manifest: ModuleManifest = {
  id: '{name}',                           // must match backend PluginManifest.id
  icon: '{LucideIconName}',              // e.g. 'Clock', 'GitPullRequest'
  titleKey: 'plugins.{camelName}Title',   // i18n key
  descKey: 'plugins.{camelName}Desc',     // i18n key
  primary: false,                         // true = highlighted card (dark bg)
  routePath: '{name}',                    // URL: /projects/{id}/{routePath}
  order: {N},                             // display order (lower = first)
};

export default {name}Manifest;
```

**ModuleManifest interface (do not modify):**

```typescript
interface ModuleManifest {
  id: string;             // must match backend id
  icon: string;           // Lucide icon component name
  titleKey: string;       // i18n key (format: 'plugins.xxxTitle')
  descKey: string;        // i18n key (format: 'plugins.xxxDesc')
  primary: boolean;       // visual emphasis on the card
  routePath: string;      // appended to /projects/[id]/
  order: number;          // sort order in Features tab
}
```

**Order assignment:** Check existing manifests for current max order. Your plugin should be max + 1. Current order assignments:
- craft: 1
- todo: 2
- knowledge-base: 3

---

### Step 8: Register Frontend Plugin

**Edit** `src/lib/plugins/plugin-registry.ts`:

1. Add icon import to the Lucide import line:
   ```typescript
   import { Sparkles, CheckSquare, BookOpen, {YourIcon}, type LucideIcon } from 'lucide-react';
   ```

2. Add manifest import:
   ```typescript
   import {name}Manifest from './manifests/{name}';
   ```

3. Add to `allModules` array:
   ```typescript
   const allModules: ModuleManifest[] = [
     craftManifest,
     todoManifest,
     knowledgeBaseManifest,
     {name}Manifest,            // <-- add here
   ].sort((a, b) => a.order - b.order);
   ```

4. Add to `iconMap`:
   ```typescript
   const iconMap: Record<string, LucideIcon> = {
     Sparkles,
     CheckSquare,
     BookOpen,
     {YourIcon}: {YourIcon},    // <-- add here
   };
   ```

---

### Step 9: Add i18n Keys

**Edit both** `src/i18n/locales/en.json` and `src/i18n/locales/zh.json`.

Add entries inside the `"plugins"` namespace:

```json
{
  "plugins": {
    "...existing keys...",
    "{camelName}Title": "Your Plugin Name",
    "{camelName}Desc": "One-line description of what this plugin does",
    "{camelName}ComingSoonDesc": "Longer description shown on the placeholder page"
  }
}
```

**Rules:**
- Keys use camelCase: `timelineTitle`, `timelineDesc`
- Both language files must have identical key sets
- No emojis anywhere

---

### Step 10: Frontend Page (`src/app/(project)/projects/[id]/{name}/page.tsx`)

For a placeholder (Coming Soon) page:

```tsx
'use client';

import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, {YourIcon} } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function {PascalName}Page() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const t = useTranslations('plugins');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      <header className="flex items-center gap-4 px-6 md:px-12 pt-6 pb-4 bg-white/90 backdrop-blur-xl border-b border-[var(--border)]">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="text-foreground-muted transition-all hover:text-foreground hover:-translate-x-0.5"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold tracking-tight">{t('{camelName}Title')}</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 bg-surface-subtle">
        <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-[var(--border)] flex items-center justify-center">
            <{YourIcon} size={32} className="text-foreground-muted" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t('comingSoon')}</h2>
          <p className="text-sm text-foreground-muted max-w-sm leading-relaxed">{t('{camelName}ComingSoonDesc')}</p>
        </div>
      </main>
    </div>
  );
}
```

For a **fully functional** page, replace the `<main>` content with your actual UI. Use `http` from `@/lib/http` for API calls, and `useMessage` from `@/components/ui/message/message-provider` for notifications.

---

## Verification Checklist

After completing all steps, verify each item:

| # | Check | Command / Action |
|---|-------|-----------------|
| 1 | TypeScript compiles | `cd server && npx tsc --noEmit` |
| 2 | Plugin appears in metadata | `curl http://localhost:{PORT}/api/plugins` |
| 3 | CRUD endpoints respond | `curl http://localhost:{PORT}/api/{name}/{projectId}` (with auth) |
| 4 | Project create triggers hook | Create project, verify plugin data initialized |
| 5 | Project delete triggers hook | Delete project, verify plugin data cleaned up |
| 6 | Frontend card renders | Open project detail -> Features tab |
| 7 | Page loads | Click the plugin card |
| 8 | i18n works | Switch language in Settings, verify translations |
| 9 | JSON valid | `python3 -c "import json; json.load(open('src/i18n/locales/en.json'))"` |

---

## Complete File Reference

### Existing infrastructure files (DO NOT MODIFY these):

| File | Purpose |
|------|---------|
| `server/src/plugins/plugin.types.ts` | `PluginManifest` interface |
| `server/src/plugins/plugin-registry.ts` | `PluginRegistry` class (singleton) |
| `server/src/middleware/auth.ts` | `authenticate` middleware (JWT) |
| `server/src/utils/response.ts` | `sendSuccess()` / `sendError()` helpers |
| `server/src/config/database.ts` | Prisma client instance |
| `src/lib/plugins/plugin.types.ts` | `ModuleManifest` interface |
| `src/lib/http.ts` | Axios instance with interceptors |

### Files you MUST MODIFY per plugin:

| File | What to add |
|------|-------------|
| `server/src/plugins/index.ts` | Import + `pluginRegistry.register()` |
| `server/prisma/db.sql` | Table definition |
| `server/prisma/schema.prisma` | Prisma model |
| `src/lib/plugins/plugin-registry.ts` | Import manifest + icon |
| `src/i18n/locales/en.json` | Plugin i18n keys in `"plugins"` namespace |
| `src/i18n/locales/zh.json` | Plugin i18n keys in `"plugins"` namespace |

---

## Common Mistakes to Avoid

1. **`sendSuccess` third argument is `message`, not `statusCode`.** Use `sendSuccess(res, data, undefined, 201)` for 201 responses.
2. **Forgetting to add icon to `iconMap`** in `src/lib/plugins/plugin-registry.ts`. The card will fall back to a default icon silently.
3. **Mismatched plugin ID** between backend `PluginManifest.id` and frontend `ModuleManifest.id`. They must be identical.
4. **Adding foreign key constraints** in SQL. This project explicitly forbids FK constraints at the database level.
5. **Non-nullable new columns** on existing tables. New columns on existing tables MUST be nullable for backward compatibility.
6. **Missing `authenticate` middleware** on routes. Every route must use it.
7. **Forgetting to validate item ownership** in update/delete handlers. Always check `existing.projectId !== projectId`.
8. **Not running `prisma migrate dev`** after schema changes. The Prisma client won't know about new models until migration runs.
