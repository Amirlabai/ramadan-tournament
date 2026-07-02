-- CreateEnum
CREATE TYPE "AnalyticsEventSource" AS ENUM ('client', 'server');

-- CreateEnum
CREATE TYPE "AnalyticsEventCategory" AS ENUM ('auth', 'registration', 'browse', 'player_zone', 'interaction');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_name" TEXT NOT NULL,
    "category" "AnalyticsEventCategory" NOT NULL,
    "source" "AnalyticsEventSource" NOT NULL,
    "session_id" TEXT,
    "user_id" TEXT,
    "path" TEXT,
    "properties" JSONB,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

-- CreateIndex
CREATE INDEX "analytics_events_event_name_created_at_idx" ON "analytics_events"("event_name", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_created_at_idx" ON "analytics_events"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_created_at_idx" ON "analytics_events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
