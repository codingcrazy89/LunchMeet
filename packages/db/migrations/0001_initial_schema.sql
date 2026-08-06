CREATE TYPE "public"."attendee_status" AS ENUM('pending', 'accepted', 'denied');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('invite', 'join_request', 'cohost_added', 'new_message', 'request_accepted', 'rate_attendees', 'user_report');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
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
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" "citext" NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "lunch_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lunch_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "attendee_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunch_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lunch_id" uuid NOT NULL,
	"inviter_id" text NOT NULL,
	"invitee_id" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" text NOT NULL,
	"co_host_id" text,
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
CREATE TABLE "chat_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lunch_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_room_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_contacts_no_self" CHECK ("user_contacts"."user_id" <> "user_contacts"."contact_id")
);
--> statement-breakpoint
CREATE TABLE "user_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lunch_id" uuid NOT NULL,
	"rater_id" text NOT NULL,
	"rated_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ratings_rating_range" CHECK ("user_ratings"."rating" between 1 and 5),
	CONSTRAINT "user_ratings_no_self" CHECK ("user_ratings"."rater_id" <> "user_ratings"."rated_id")
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" text NOT NULL,
	"reported_id" text NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_reports_no_self" CHECK ("user_reports"."reporter_id" <> "user_reports"."reported_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunch_attendees" ADD CONSTRAINT "lunch_attendees_lunch_id_lunches_id_fk" FOREIGN KEY ("lunch_id") REFERENCES "public"."lunches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunch_attendees" ADD CONSTRAINT "lunch_attendees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunch_invites" ADD CONSTRAINT "lunch_invites_lunch_id_lunches_id_fk" FOREIGN KEY ("lunch_id") REFERENCES "public"."lunches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunch_invites" ADD CONSTRAINT "lunch_invites_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunch_invites" ADD CONSTRAINT "lunch_invites_invitee_id_user_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunches" ADD CONSTRAINT "lunches_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunches" ADD CONSTRAINT "lunches_co_host_id_user_id_fk" FOREIGN KEY ("co_host_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_lunch_id_lunches_id_fk" FOREIGN KEY ("lunch_id") REFERENCES "public"."lunches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_room_id_chat_rooms_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contacts" ADD CONSTRAINT "user_contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contacts" ADD CONSTRAINT "user_contacts_contact_id_user_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_lunch_id_lunches_id_fk" FOREIGN KEY ("lunch_id") REFERENCES "public"."lunches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_rater_id_user_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_rated_id_user_id_fk" FOREIGN KEY ("rated_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_id_user_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_key" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_key" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_key" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "profiles_suspended_idx" ON "profiles" USING btree ("suspended");--> statement-breakpoint
CREATE INDEX "profiles_name_trgm_idx" ON "profiles" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "lunch_attendees_lunch_user_key" ON "lunch_attendees" USING btree ("lunch_id","user_id");--> statement-breakpoint
CREATE INDEX "lunch_attendees_user_id_idx" ON "lunch_attendees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lunch_attendees_lunch_status_idx" ON "lunch_attendees" USING btree ("lunch_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "lunch_invites_lunch_invitee_key" ON "lunch_invites" USING btree ("lunch_id","invitee_id");--> statement-breakpoint
CREATE INDEX "lunch_invites_invitee_idx" ON "lunch_invites" USING btree ("invitee_id");--> statement-breakpoint
CREATE INDEX "lunches_host_id_idx" ON "lunches" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "lunches_co_host_id_idx" ON "lunches" USING btree ("co_host_id");--> statement-breakpoint
CREATE INDEX "lunches_date_time_idx" ON "lunches" USING btree ("date_time");--> statement-breakpoint
CREATE INDEX "lunches_is_public_idx" ON "lunches" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "lunches_rating_prompt_pending_idx" ON "lunches" USING btree ("date_time") WHERE "lunches"."rating_prompt_sent_at" is null;--> statement-breakpoint
CREATE INDEX "lunches_earth_idx" ON "lunches" USING gist (ll_to_earth("latitude", "longitude"));--> statement-breakpoint
CREATE UNIQUE INDEX "chat_rooms_lunch_id_key" ON "chat_rooms" USING btree ("lunch_id");--> statement-breakpoint
CREATE INDEX "messages_room_created_idx" ON "messages" USING btree ("chat_room_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_contacts_user_contact_key" ON "user_contacts" USING btree ("user_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_ratings_rater_rated_lunch_key" ON "user_ratings" USING btree ("rater_id","rated_id","lunch_id");--> statement-breakpoint
CREATE INDEX "user_ratings_rated_id_idx" ON "user_ratings" USING btree ("rated_id");--> statement-breakpoint
CREATE INDEX "user_reports_reported_id_idx" ON "user_reports" USING btree ("reported_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens" USING btree ("user_id");