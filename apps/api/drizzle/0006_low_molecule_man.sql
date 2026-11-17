CREATE TABLE "register_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"month" text NOT NULL,
	"attendance" smallint,
	"academics" smallint,
	"duties" smallint,
	"activities" smallint,
	"conduct" smallint,
	"remarks" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"entered_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"mentor_id" text NOT NULL,
	"month" text NOT NULL,
	"suggestion_shown" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"mentor_id" text NOT NULL,
	"metric" text NOT NULL,
	"month" text NOT NULL,
	"goal" smallint NOT NULL,
	"flag_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "register_rows" ADD CONSTRAINT "register_rows_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_rows" ADD CONSTRAINT "register_rows_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "register_student_month_uq" ON "register_rows" USING btree ("student_id","month");--> statement-breakpoint
CREATE INDEX "review_decisions_student_idx" ON "review_decisions" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "targets_student_metric_month_uq" ON "targets" USING btree ("student_id","metric","month");