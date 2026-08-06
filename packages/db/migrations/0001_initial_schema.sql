CREATE SCHEMA "lunchmeet";
--> statement-breakpoint
CREATE TYPE "lunchmeet"."attendee_status" AS ENUM('pending', 'accepted', 'denied');--> statement-breakpoint
CREATE TYPE "lunchmeet"."invite_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "lunchmeet"."notification_type" AS ENUM('invite', 'join_request', 'cohost_added', 'new_message', 'request_accepted', 'rate_attendees', 'user_report');--> statement-breakpoint
CREATE TABLE "lunchmeet"."account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" "citext" NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"age" integer,
	"gender" text,
	"bio" text,
	"social_media_url" text,
	"photo_keys" text[] DEFAULT '{}' NOT NULL,
	"looking_for" text[] DEFAULT '{}' NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"flagged_for_investigation" boolean DEFAULT false NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."lunch_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lunch_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "lunchmeet"."attendee_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."lunch_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lunch_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"status" "lunchmeet"."invite_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."lunches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"co_host_id" uuid,
	"place_id" text,
	"restaurant_name" text NOT NULL,
	"restaurant_address" text,
	"latitude" double precision,
	"longitude" double precision,
	"date_time" timestamp with time zone NOT NULL,
	"seats" integer NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"visibility_gender" text[],
	"visibility_looking_for" text[],
	"rating_prompt_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."chat_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lunch_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_room_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."user_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_contacts_no_self" CHECK ("lunchmeet"."user_contacts"."user_id" <> "lunchmeet"."user_contacts"."contact_id")
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."user_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lunch_id" uuid NOT NULL,
	"rater_id" uuid NOT NULL,
	"rated_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ratings_rating_range" CHECK ("lunchmeet"."user_ratings"."rating" between 1 and 5),
	CONSTRAINT "user_ratings_no_self" CHECK ("lunchmeet"."user_ratings"."rater_id" <> "lunchmeet"."user_ratings"."rated_id")
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."user_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_reports_no_self" CHECK ("lunchmeet"."user_reports"."reporter_id" <> "lunchmeet"."user_reports"."reported_id")
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "lunchmeet"."notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunchmeet"."push_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lunchmeet"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."lunch_attendees" ADD CONSTRAINT "lunch_attendees_lunch_id_lunches_id_fk" FOREIGN KEY ("lunch_id") REFERENCES "lunchmeet"."lunches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."lunch_attendees" ADD CONSTRAINT "lunch_attendees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."lunch_invites" ADD CONSTRAINT "lunch_invites_lunch_id_lunches_id_fk" FOREIGN KEY ("lunch_id") REFERENCES "lunchmeet"."lunches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."lunch_invites" ADD CONSTRAINT "lunch_invites_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."lunch_invites" ADD CONSTRAINT "lunch_invites_invitee_id_user_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."lunches" ADD CONSTRAINT "lunches_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."lunches" ADD CONSTRAINT "lunches_co_host_id_user_id_fk" FOREIGN KEY ("co_host_id") REFERENCES "lunchmeet"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."chat_rooms" ADD CONSTRAINT "chat_rooms_lunch_id_lunches_id_fk" FOREIGN KEY ("lunch_id") REFERENCES "lunchmeet"."lunches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."messages" ADD CONSTRAINT "messages_chat_room_id_chat_rooms_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "lunchmeet"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."user_contacts" ADD CONSTRAINT "user_contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."user_contacts" ADD CONSTRAINT "user_contacts_contact_id_user_id_fk" FOREIGN KEY ("contact_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."user_ratings" ADD CONSTRAINT "user_ratings_lunch_id_lunches_id_fk" FOREIGN KEY ("lunch_id") REFERENCES "lunchmeet"."lunches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."user_ratings" ADD CONSTRAINT "user_ratings_rater_id_user_id_fk" FOREIGN KEY ("rater_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."user_ratings" ADD CONSTRAINT "user_ratings_rated_id_user_id_fk" FOREIGN KEY ("rated_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."user_reports" ADD CONSTRAINT "user_reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."user_reports" ADD CONSTRAINT "user_reports_reported_id_user_id_fk" FOREIGN KEY ("reported_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunchmeet"."push_tokens" ADD CONSTRAINT "push_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "lunchmeet"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "lunchmeet"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_key" ON "lunchmeet"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_key" ON "lunchmeet"."session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "lunchmeet"."session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_key" ON "lunchmeet"."user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "lunchmeet"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "profiles_suspended_idx" ON "lunchmeet"."profiles" USING btree ("suspended");--> statement-breakpoint
CREATE INDEX "profiles_name_trgm_idx" ON "lunchmeet"."profiles" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "lunch_attendees_lunch_user_key" ON "lunchmeet"."lunch_attendees" USING btree ("lunch_id","user_id");--> statement-breakpoint
CREATE INDEX "lunch_attendees_user_id_idx" ON "lunchmeet"."lunch_attendees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lunch_attendees_lunch_status_idx" ON "lunchmeet"."lunch_attendees" USING btree ("lunch_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "lunch_invites_lunch_invitee_key" ON "lunchmeet"."lunch_invites" USING btree ("lunch_id","invitee_id");--> statement-breakpoint
CREATE INDEX "lunch_invites_invitee_idx" ON "lunchmeet"."lunch_invites" USING btree ("invitee_id");--> statement-breakpoint
CREATE INDEX "lunches_host_id_idx" ON "lunchmeet"."lunches" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "lunches_co_host_id_idx" ON "lunchmeet"."lunches" USING btree ("co_host_id");--> statement-breakpoint
CREATE INDEX "lunches_date_time_idx" ON "lunchmeet"."lunches" USING btree ("date_time");--> statement-breakpoint
CREATE INDEX "lunches_is_public_idx" ON "lunchmeet"."lunches" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "lunches_rating_prompt_pending_idx" ON "lunchmeet"."lunches" USING btree ("date_time") WHERE "lunchmeet"."lunches"."rating_prompt_sent_at" is null;--> statement-breakpoint
CREATE INDEX "lunches_earth_idx" ON "lunchmeet"."lunches" USING gist (ll_to_earth("latitude", "longitude"));--> statement-breakpoint
CREATE UNIQUE INDEX "chat_rooms_lunch_id_key" ON "lunchmeet"."chat_rooms" USING btree ("lunch_id");--> statement-breakpoint
CREATE INDEX "messages_room_created_idx" ON "lunchmeet"."messages" USING btree ("chat_room_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_contacts_user_contact_key" ON "lunchmeet"."user_contacts" USING btree ("user_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_ratings_rater_rated_lunch_key" ON "lunchmeet"."user_ratings" USING btree ("rater_id","rated_id","lunch_id");--> statement-breakpoint
CREATE INDEX "user_ratings_rated_id_idx" ON "lunchmeet"."user_ratings" USING btree ("rated_id");--> statement-breakpoint
CREATE INDEX "user_reports_reported_id_idx" ON "lunchmeet"."user_reports" USING btree ("reported_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "lunchmeet"."notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "lunchmeet"."notifications" USING btree ("user_id") WHERE "lunchmeet"."notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "push_tokens_user_id_idx" ON "lunchmeet"."push_tokens" USING btree ("user_id");