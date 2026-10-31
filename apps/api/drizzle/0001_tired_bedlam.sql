ALTER TABLE "users" ADD COLUMN "login_code_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_login_code_uq" ON "users" USING btree ("login_code_hash");