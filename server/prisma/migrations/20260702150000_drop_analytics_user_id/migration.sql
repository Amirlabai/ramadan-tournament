-- DropForeignKey
ALTER TABLE "analytics_events" DROP CONSTRAINT IF EXISTS "analytics_events_user_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "analytics_events_user_id_created_at_idx";

-- AlterTable
ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "user_id";
