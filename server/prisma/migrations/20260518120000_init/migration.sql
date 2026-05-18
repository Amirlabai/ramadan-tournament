-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');
CREATE TYPE "Division" AS ENUM ('boys', 'girls');
CREATE TYPE "ScoringMode" AS ENUM ('football', 'points');
CREATE TYPE "SquadRole" AS ENUM ('captain', 'goalkeeper', 'attack', 'defense');
CREATE TYPE "TeamStatus" AS ENUM ('pending', 'active', 'rejected');
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'owner_approved', 'approved', 'rejected', 'invalidated');
CREATE TYPE "SeasonRegistrationStatus" AS ENUM ('none', 'join_pending', 'awaiting_invoice', 'invoice_assigned', 'active', 'archived');
CREATE TYPE "MatchPhase" AS ENUM ('group', 'knockout');
CREATE TYPE "NewsPriority" AS ENUM ('normal', 'high');

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "division" "Division" NOT NULL,
    "display_name" TEXT NOT NULL,
    "scoring_mode" "ScoringMode" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "password" TEXT,
    "google_id" TEXT,
    "display_name" TEXT NOT NULL DEFAULT 'User',
    "avatar_url" TEXT,
    "google_picture_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "active_division" "Division",
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "verification_token_expires" TIMESTAMP(3),
    "mapped_player_info" JSONB,
    "player_profile" JSONB,
    "pending_team_request" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "season_registrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "division" "Division" NOT NULL,
    "status" "SeasonRegistrationStatus" NOT NULL DEFAULT 'none',
    "redeemed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "season_registrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_codes" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "assigned_user_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "redeemed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teams" (
    "id" INTEGER NOT NULL,
    "season_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "logo_position" TEXT DEFAULT 'right',
    "status" "TeamStatus" NOT NULL DEFAULT 'active',
    "owner_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teams_pkey" PRIMARY KEY ("season_id","id")
);

CREATE TABLE "players" (
    "member_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "season_id" TEXT NOT NULL,
    "user_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL DEFAULT '',
    "nickname" TEXT NOT NULL DEFAULT '',
    "number" INTEGER NOT NULL,
    "position" TEXT NOT NULL DEFAULT '',
    "squad_role" "SquadRole",
    "is_captain" BOOLEAN NOT NULL DEFAULT false,
    "head_photo" TEXT,
    "pending_head_photo" TEXT,
    "bio" TEXT NOT NULL DEFAULT '',
    "personal_id_enc" TEXT,
    "birth_year" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "players_pkey" PRIMARY KEY ("member_id")
);

CREATE TABLE "matches" (
    "id" INTEGER NOT NULL,
    "season_id" TEXT NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "location" TEXT NOT NULL,
    "phase" "MatchPhase" NOT NULL DEFAULT 'group',
    "team1_id" INTEGER NOT NULL,
    "team2_id" INTEGER NOT NULL,
    "score1" INTEGER,
    "score2" INTEGER,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "matches_pkey" PRIMARY KEY ("season_id","id")
);

CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "match_id" INTEGER NOT NULL,
    "season_id" TEXT NOT NULL,
    "member_id" INTEGER NOT NULL,
    "minute" INTEGER,
    "is_own_goal" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bracket_slots" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "slot_key" TEXT NOT NULL,
    "round" TEXT NOT NULL,
    "slot_order" INTEGER NOT NULL,
    "match_id" INTEGER,
    "team1_id" INTEGER,
    "team2_id" INTEGER,
    CONSTRAINT "bracket_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news" (
    "id" INTEGER NOT NULL,
    "season_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "priority" "NewsPriority" NOT NULL DEFAULT 'normal',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "news_pkey" PRIMARY KEY ("season_id","id")
);

CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "match_id" INTEGER NOT NULL,
    "season_id" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'Anonymous',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'mvp',
    "player_member_id" INTEGER,
    "team_id" INTEGER,
    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stats_snapshots" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "standings" JSONB NOT NULL,
    "top_scorers" JSONB NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stats_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "season_archives" (
    "season_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "division" "Division" NOT NULL,
    "display_name" TEXT NOT NULL,
    "winner" JSONB NOT NULL,
    "top_scorer" JSONB NOT NULL,
    "mvp" JSONB,
    "standings" JSONB NOT NULL,
    "top_scorers" JSONB NOT NULL,
    "playoffs" JSONB NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "season_archives_pkey" PRIMARY KEY ("season_id")
);

CREATE TABLE "point_entries" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "team_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "note" TEXT,
    "recorded_by_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "point_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_creation_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_creation_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_join_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "team_id" INTEGER NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "owner_reviewed_at" TIMESTAMP(3),
    "owner_reviewed_by" TEXT,
    "admin_reviewed_at" TIMESTAMP(3),
    "admin_reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_join_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_transfer_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "from_team_id" INTEGER NOT NULL,
    "to_team_id" INTEGER NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_transfer_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "banned_words" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'he',
    CONSTRAINT "banned_words_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "seasons_year_month_division_key" ON "seasons"("year_month", "division");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX "season_registrations_user_id_season_id_key" ON "season_registrations"("user_id", "season_id");
CREATE UNIQUE INDEX "players_season_id_team_id_number_key" ON "players"("season_id", "team_id", "number");
CREATE UNIQUE INDEX "bracket_slots_season_id_slot_key_key" ON "bracket_slots"("season_id", "slot_key");
CREATE UNIQUE INDEX "votes_user_id_season_id_category_key" ON "votes"("user_id", "season_id", "category");
CREATE UNIQUE INDEX "season_archives_year_month_division_key" ON "season_archives"("year_month", "division");
CREATE UNIQUE INDEX "banned_words_word_key" ON "banned_words"("word");
CREATE INDEX "comments_season_id_match_id_idx" ON "comments"("season_id", "match_id");

-- ForeignKeys
ALTER TABLE "season_registrations" ADD CONSTRAINT "season_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "season_registrations" ADD CONSTRAINT "season_registrations_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_codes" ADD CONSTRAINT "invoice_codes_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_codes" ADD CONSTRAINT "invoice_codes_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_codes" ADD CONSTRAINT "invoice_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "players" ADD CONSTRAINT "players_season_id_team_id_fkey" FOREIGN KEY ("season_id", "team_id") REFERENCES "teams"("season_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_team1_fkey" FOREIGN KEY ("season_id", "team1_id") REFERENCES "teams"("season_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_team2_fkey" FOREIGN KEY ("season_id", "team2_id") REFERENCES "teams"("season_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_match_fkey" FOREIGN KEY ("season_id", "match_id") REFERENCES "matches"("season_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "players"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bracket_slots" ADD CONSTRAINT "bracket_slots_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bracket_slots" ADD CONSTRAINT "bracket_slots_match_fkey" FOREIGN KEY ("season_id", "match_id") REFERENCES "matches"("season_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news" ADD CONSTRAINT "news_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news" ADD CONSTRAINT "news_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_match_fkey" FOREIGN KEY ("season_id", "match_id") REFERENCES "matches"("season_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_team_fkey" FOREIGN KEY ("season_id", "team_id") REFERENCES "teams"("season_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stats_snapshots" ADD CONSTRAINT "stats_snapshots_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_team_fkey" FOREIGN KEY ("season_id", "team_id") REFERENCES "teams"("season_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "team_creation_requests" ADD CONSTRAINT "team_creation_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_creation_requests" ADD CONSTRAINT "team_creation_requests_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_team_fkey" FOREIGN KEY ("season_id", "team_id") REFERENCES "teams"("season_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_transfer_requests" ADD CONSTRAINT "team_transfer_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_transfer_requests" ADD CONSTRAINT "team_transfer_requests_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
