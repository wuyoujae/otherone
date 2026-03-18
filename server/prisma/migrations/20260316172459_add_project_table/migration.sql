-- CreateTable
CREATE TABLE "project" (
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
