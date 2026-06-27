-- Personal ID + birth year registration (replaces receipt flow)
ALTER TABLE "season_registrations" ADD COLUMN IF NOT EXISTS "user_personal_id_enc" TEXT;
ALTER TABLE "season_registrations" ADD COLUMN IF NOT EXISTS "user_birth_year" INTEGER;
ALTER TABLE "season_registrations" ADD COLUMN IF NOT EXISTS "user_personal_id_masked" TEXT;
ALTER TABLE "season_registrations" ADD COLUMN IF NOT EXISTS "admin_personal_id_enc" TEXT;
ALTER TABLE "season_registrations" ADD COLUMN IF NOT EXISTS "admin_birth_year" INTEGER;
