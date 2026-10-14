CREATE TYPE "public"."proof_requirement" AS ENUM('NONE', 'TEXT', 'PHOTO', 'TEXT_OR_PHOTO');--> statement-breakpoint
CREATE TYPE "public"."stamp_request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('OWNER', 'MEMBER');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_provider_identity_unique" UNIQUE("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "card_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ask_user_id" text NOT NULL,
	"approve_user_id" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"stamps_needed" integer NOT NULL,
	"proof_requirement" "proof_requirement" DEFAULT 'NONE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "card_definition_participants_unique" UNIQUE("id","workspace_id","ask_user_id","approve_user_id"),
	CONSTRAINT "card_definition_target_positive" CHECK ("card_definition"."stamps_needed" > 0),
	CONSTRAINT "card_definition_title_nonempty" CHECK (length(trim("card_definition"."title")) > 0),
	CONSTRAINT "card_definition_category_nonempty" CHECK (length(trim("card_definition"."category")) > 0),
	CONSTRAINT "card_definition_archive_date" CHECK ("card_definition"."archived_at" is null or "card_definition"."archived_at" >= "card_definition"."created_at")
);
--> statement-breakpoint
CREATE TABLE "card_instance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_definition_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"stamps_needed" integer NOT NULL,
	"current_stamps" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	CONSTRAINT "card_instance_definition_unique" UNIQUE("id","card_definition_id"),
	CONSTRAINT "card_instance_target_positive" CHECK ("card_instance"."stamps_needed" > 0),
	CONSTRAINT "card_instance_progress_range" CHECK ("card_instance"."current_stamps" >= 0 and "card_instance"."current_stamps" <= "card_instance"."stamps_needed"),
	CONSTRAINT "card_instance_completion_matches_progress" CHECK (
    ("card_instance"."completed_at" is null and "card_instance"."current_stamps" < "card_instance"."stamps_needed") or
    ("card_instance"."completed_at" is not null and "card_instance"."current_stamps" = "card_instance"."stamps_needed")
  ),
	CONSTRAINT "card_instance_completion_date" CHECK ("card_instance"."completed_at" is null or "card_instance"."completed_at" >= "card_instance"."created_at"),
	CONSTRAINT "card_instance_redemption_requires_completion" CHECK (
    "card_instance"."redeemed_at" is null or
    ("card_instance"."completed_at" is not null and "card_instance"."redeemed_at" >= "card_instance"."completed_at")
  )
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stamp_allocation" (
	"stamp_request_id" uuid NOT NULL,
	"card_instance_id" uuid NOT NULL,
	"card_definition_id" uuid NOT NULL,
	"stamps_allocated" integer NOT NULL,
	CONSTRAINT "stamp_allocation_stamp_request_id_card_instance_id_pk" PRIMARY KEY("stamp_request_id","card_instance_id"),
	CONSTRAINT "stamp_allocation_quantity_positive" CHECK ("stamp_allocation"."stamps_allocated" > 0)
);
--> statement-breakpoint
CREATE TABLE "stamp_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"card_definition_id" uuid NOT NULL,
	"ask_user_id" text NOT NULL,
	"review_user_id" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"proof_requirement" "proof_requirement" DEFAULT 'NONE' NOT NULL,
	"stamps_requested" integer NOT NULL,
	"stamps_awarded" integer,
	"proof_text" text,
	"photo_key" text,
	"photo_expires_at" timestamp with time zone,
	"status" "stamp_request_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "stamp_request_definition_unique" UNIQUE("id","card_definition_id"),
	CONSTRAINT "stamp_request_title_nonempty" CHECK (length(trim("stamp_request"."title")) > 0),
	CONSTRAINT "stamp_request_quantity_positive" CHECK ("stamp_request"."stamps_requested" > 0),
	CONSTRAINT "stamp_request_award_matches_status" CHECK (
    ("stamp_request"."status" = 'APPROVED' and "stamp_request"."stamps_awarded" is not null and "stamp_request"."stamps_awarded" > 0) or
    ("stamp_request"."status" <> 'APPROVED' and "stamp_request"."stamps_awarded" is null)
  ),
	CONSTRAINT "stamp_request_review_matches_status" CHECK (
    ("stamp_request"."status" in ('APPROVED', 'REJECTED') and "stamp_request"."reviewed_at" is not null) or
    ("stamp_request"."status" in ('PENDING', 'CANCELLED') and "stamp_request"."reviewed_at" is null)
  ),
	CONSTRAINT "stamp_request_review_date" CHECK ("stamp_request"."reviewed_at" is null or "stamp_request"."reviewed_at" >= "stamp_request"."created_at")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
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
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_name_nonempty" CHECK (length(trim("workspace"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_member" (
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_role" DEFAULT 'MEMBER' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_member_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_definition" ADD CONSTRAINT "card_definition_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_definition" ADD CONSTRAINT "card_definition_ask_user_id_user_id_fk" FOREIGN KEY ("ask_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_definition" ADD CONSTRAINT "card_definition_approve_user_id_user_id_fk" FOREIGN KEY ("approve_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_instance" ADD CONSTRAINT "card_instance_card_definition_id_card_definition_id_fk" FOREIGN KEY ("card_definition_id") REFERENCES "public"."card_definition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamp_allocation" ADD CONSTRAINT "stamp_allocation_request_definition_fk" FOREIGN KEY ("stamp_request_id","card_definition_id") REFERENCES "public"."stamp_request"("id","card_definition_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamp_allocation" ADD CONSTRAINT "stamp_allocation_instance_definition_fk" FOREIGN KEY ("card_instance_id","card_definition_id") REFERENCES "public"."card_instance"("id","card_definition_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamp_request" ADD CONSTRAINT "stamp_request_definition_participants_fk" FOREIGN KEY ("card_definition_id","workspace_id","ask_user_id","review_user_id") REFERENCES "public"."card_definition"("id","workspace_id","ask_user_id","approve_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "card_definition_workspace_category_idx" ON "card_definition" USING btree ("workspace_id","category");--> statement-breakpoint
CREATE INDEX "card_definition_requester_idx" ON "card_definition" USING btree ("ask_user_id");--> statement-breakpoint
CREATE INDEX "card_definition_approver_idx" ON "card_definition" USING btree ("approve_user_id");--> statement-breakpoint
CREATE INDEX "card_instance_definition_created_idx" ON "card_instance" USING btree ("card_definition_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "card_instance_one_open_per_definition" ON "card_instance" USING btree ("card_definition_id") WHERE "card_instance"."completed_at" is null;--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stamp_allocation_instance_idx" ON "stamp_allocation" USING btree ("card_instance_id");--> statement-breakpoint
CREATE INDEX "stamp_request_incoming_idx" ON "stamp_request" USING btree ("workspace_id","review_user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "stamp_request_outgoing_idx" ON "stamp_request" USING btree ("workspace_id","ask_user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "stamp_request_definition_idx" ON "stamp_request" USING btree ("card_definition_id");--> statement-breakpoint
CREATE INDEX "stamp_request_photo_expiry_idx" ON "stamp_request" USING btree ("photo_expires_at") WHERE "stamp_request"."photo_key" is not null;--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "workspace_member_user_idx" ON "workspace_member" USING btree ("user_id");