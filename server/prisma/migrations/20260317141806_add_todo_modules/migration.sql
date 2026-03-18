-- AlterTable
ALTER TABLE "todo_item" ADD COLUMN     "end_date" DATE,
ADD COLUMN     "end_time" VARCHAR(5),
ADD COLUMN     "module_id" UUID,
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "start_time" VARCHAR(5);

-- CreateTable
CREATE TABLE "todo_module" (
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
