CREATE TABLE "campuses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_pilot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"student_id" text NOT NULL,
	"kind" text NOT NULL,
	"granted" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consents_student_id_kind_pk" PRIMARY KEY("student_id","kind")
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"mentor_id" text NOT NULL,
	"rule" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"week" text NOT NULL,
	"reason" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opener_draft" text,
	"opener_sent" text,
	"dismiss_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hostels" (
	"id" text PRIMARY KEY NOT NULL,
	"campus_id" text NOT NULL,
	"name" text NOT NULL,
	"subchannel_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"code" text PRIMARY KEY NOT NULL,
	"campus_id" text NOT NULL,
	"role" text NOT NULL,
	"hostel_id" text,
	"max_uses" integer DEFAULT 100 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentor_assignments" (
	"student_id" text PRIMARY KEY NOT NULL,
	"mentor_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulses" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"week" text NOT NULL,
	"studies" smallint NOT NULL,
	"money" smallint NOT NULL,
	"health" smallint NOT NULL,
	"home" smallint NOT NULL,
	"note" text,
	"wants_to_talk" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_events" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"message_id" text,
	"matched_term" text NOT NULL,
	"alerted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"campus_id" text NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"hostel_id" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hostels" ADD CONSTRAINT "hostels_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulses" ADD CONSTRAINT "pulses_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_events" ADD CONSTRAINT "safety_events_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flags_mentor_status_idx" ON "flags" USING btree ("mentor_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "flags_dedupe_uq" ON "flags" USING btree ("student_id","rule","area","week");--> statement-breakpoint
CREATE UNIQUE INDEX "pulses_student_week_uq" ON "pulses" USING btree ("student_id","week");--> statement-breakpoint
CREATE INDEX "users_campus_idx" ON "users" USING btree ("campus_id");