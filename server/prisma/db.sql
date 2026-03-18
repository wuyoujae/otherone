-- OtherOne Database Schema
-- This file is the single source of truth for the database schema.
-- Update this file first, then sync prisma/schema.prisma accordingly.

-- User table
-- Stores user account information
CREATE TABLE "user" (
    id UUID PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    github_id VARCHAR(100) UNIQUE,
    status INT NOT NULL DEFAULT 0,              -- 0: active, 1: disabled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project table
-- Stores project information for the workspace
CREATE TABLE project (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tag VARCHAR(100),
    icon VARCHAR(50) NOT NULL DEFAULT 'Box',
    status INT NOT NULL DEFAULT 0,              -- 0: draft (not started), 1: active (craft saved), 2: archived
    ai_status INT NOT NULL DEFAULT 0,           -- 0: idle, 1: ai-running, 2: review
    ai_status_text VARCHAR(500),                -- current AI task description
    ai_agent_name VARCHAR(100),                 -- current AI agent name, NULL when idle
    progress INT NOT NULL DEFAULT 0,            -- overall progress 0-100
    system_prompt TEXT,                          -- project-level AI system prompt override
    user_id UUID,                               -- logical relationship to user (no FK constraint)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project member table
-- Stores project member relationships (both users and AI agents)
CREATE TABLE project_member (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,                   -- logical relationship to project (no FK constraint)
    user_id UUID,                               -- NULL for AI members
    member_type INT NOT NULL,                   -- 1: user, 2: ai
    display_label VARCHAR(50) NOT NULL,         -- avatar label, e.g. "W", "AI"
    role INT NOT NULL DEFAULT 3,                -- 1: owner, 2: admin, 3: member
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Craft table (legacy, kept for backward compatibility)
CREATE TABLE craft (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE,
    title VARCHAR(500),
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Craft node table
-- File/directory tree for the Craft workspace (plugin: craft)
-- node_type: 1 = file (.craft), 2 = directory (.module)
CREATE TABLE craft_node (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,                   -- logical relationship to project (no FK)
    parent_id UUID,                             -- NULL = root level, logical ref to craft_node (no FK)
    name VARCHAR(255) NOT NULL,                 -- display name without extension
    node_type INT NOT NULL,                     -- 1: file (.craft), 2: directory (.module)
    content TEXT,                               -- markdown content (files only, NULL for directories)
    sort_order INT NOT NULL DEFAULT 0,
    created_by UUID,                            -- logical relationship to user (no FK)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Todo module table
-- Nested grouping structure for todo tasks (plugin: todo)
-- Like folders: "User Auth" -> "Frontend" -> "Login Page"
CREATE TABLE todo_module (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,                   -- logical relationship to project (no FK)
    parent_id UUID,                             -- NULL = root level, logical ref to todo_module (no FK)
    name VARCHAR(255) NOT NULL,
    color VARCHAR(20),                          -- hex color for visual grouping, e.g. "#6366f1"
    sort_order INT NOT NULL DEFAULT 0,
    created_by UUID,                            -- logical relationship to user (no FK)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Todo item table
-- Stores todo/task items for project task management (plugin: todo)
-- Time logic:
--   no dates + no times   = ongoing, all day every day
--   start_date only       = from that date, ongoing
--   end_date only         = until that date
--   both dates            = specific date range
--   no times              = whole day
--   start_time only       = from that time each day
--   end_time only         = until that time each day
--   both times            = specific time block each day
CREATE TABLE todo_item (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,                   -- logical relationship to project (no FK)
    module_id UUID,                             -- logical relationship to todo_module (no FK)
    title VARCHAR(500) NOT NULL,
    description TEXT,                           -- short summary
    content TEXT,                               -- rich craft content (markdown from CraftEditor)
    status INT NOT NULL DEFAULT 1,              -- 1: todo, 2: in_progress, 3: done
    priority INT NOT NULL DEFAULT 2,            -- 1: low, 2: medium, 3: high, 4: urgent
    assignee_id UUID,                           -- logical relationship to user (no FK)
    due_date TIMESTAMPTZ,                       -- legacy, kept for backward compatibility
    start_date DATE,                            -- task start date
    end_date DATE,                              -- task end date
    start_time VARCHAR(5),                      -- "HH:MM" format, e.g. "09:00"
    end_time VARCHAR(5),                        -- "HH:MM" format, e.g. "17:00"
    sort_order INT NOT NULL DEFAULT 0,
    created_by UUID,                            -- logical relationship to user (no FK)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge base article table
-- Stores knowledge base articles for project documentation (plugin: knowledge-base)
CREATE TABLE kb_article (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,                   -- logical relationship to project (no FK)
    title VARCHAR(500) NOT NULL,
    content TEXT,
    category VARCHAR(100),
    status INT NOT NULL DEFAULT 0,              -- 0: draft, 1: published
    file_url VARCHAR(1000),                     -- for uploaded files
    file_type VARCHAR(50),                      -- mime type
    sort_order INT NOT NULL DEFAULT 0,
    created_by UUID,                            -- logical relationship to user (no FK)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
