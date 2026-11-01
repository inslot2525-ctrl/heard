CREATE TABLE "interventions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"mentor_id" text NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	"week" text NOT NULL,
	"flag_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interventions_student_idx" ON "interventions" USING btree ("student_id");