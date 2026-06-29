-- CreateEnum
CREATE TYPE "FormPreregAdminMissing" AS ENUM ('personal_id', 'birth_year');

-- CreateEnum
CREATE TYPE "FormPreregRole" AS ENUM ('captain', 'goalkeeper', 'player');

-- CreateTable
CREATE TABLE "form_prereg_entries" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "captain_email" TEXT,
    "personal_id_enc" TEXT,
    "birth_year" INTEGER,
    "admin_missing" "FormPreregAdminMissing",
    "team_name" TEXT NOT NULL,
    "role" "FormPreregRole" NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_prereg_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_prereg_entries_season_id_personal_id_enc_idx" ON "form_prereg_entries"("season_id", "personal_id_enc");

-- CreateIndex
CREATE INDEX "form_prereg_entries_season_id_birth_year_idx" ON "form_prereg_entries"("season_id", "birth_year");

-- AddForeignKey
ALTER TABLE "form_prereg_entries" ADD CONSTRAINT "form_prereg_entries_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
