ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "database_url" text,
ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "otp_codes"
ADD COLUMN IF NOT EXISTS "purpose" text DEFAULT 'login' NOT NULL,
ADD COLUMN IF NOT EXISTS "pharmacy_name" text,
ADD COLUMN IF NOT EXISTS "address" text,
ADD COLUMN IF NOT EXISTS "contact_number" text,
ADD COLUMN IF NOT EXISTS "database_url" text,
ADD COLUMN IF NOT EXISTS "pending_password_hash" text;
--> statement-breakpoint
UPDATE "users"
SET "status" = "approval_status"
WHERE "status" IS DISTINCT FROM "approval_status";
