-- CreateTable
CREATE TABLE "craft_node" (
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
