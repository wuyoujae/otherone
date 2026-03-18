-- AlterTable
ALTER TABLE "project" ADD COLUMN     "ai_agent_name" VARCHAR(100),
ADD COLUMN     "ai_status" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ai_status_text" VARCHAR(500),
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "project_member" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID,
    "member_type" INTEGER NOT NULL,
    "display_label" VARCHAR(50) NOT NULL,
    "role" INTEGER NOT NULL DEFAULT 3,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_pkey" PRIMARY KEY ("id")
);
