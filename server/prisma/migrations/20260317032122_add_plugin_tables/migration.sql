-- CreateTable
CREATE TABLE "todo_item" (
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

-- CreateTable
CREATE TABLE "kb_article" (
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
