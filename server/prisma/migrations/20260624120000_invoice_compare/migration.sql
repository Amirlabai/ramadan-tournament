-- Invoice compare + user alerts when admin receipt differs from user entry
ALTER TABLE "season_registrations" ADD COLUMN IF NOT EXISTS "invoice_alert" TEXT;

ALTER TABLE "invoice_codes" ADD COLUMN IF NOT EXISTS "code_normalized" TEXT;

CREATE INDEX IF NOT EXISTS "invoice_codes_season_id_code_normalized_idx"
  ON "invoice_codes" ("season_id", "code_normalized");
