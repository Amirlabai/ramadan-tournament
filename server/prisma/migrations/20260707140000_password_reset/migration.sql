-- AlterTable
ALTER TABLE "users" ADD COLUMN "password_reset_token" TEXT,
ADD COLUMN "password_reset_expires" TIMESTAMP(3),
ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "users_password_reset_token_idx" ON "users"("password_reset_token");
