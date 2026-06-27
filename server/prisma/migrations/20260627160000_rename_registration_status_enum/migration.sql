-- Rename SeasonRegistrationStatus enum values: invoice terminology -> identity terminology
ALTER TYPE "SeasonRegistrationStatus" RENAME VALUE 'awaiting_invoice' TO 'awaiting_identity';
ALTER TYPE "SeasonRegistrationStatus" RENAME VALUE 'invoice_assigned' TO 'identity_assigned';
