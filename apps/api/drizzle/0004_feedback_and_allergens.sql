CREATE TYPE "public"."issue_kind" AS ENUM('missing_item', 'wrong_item', 'quality', 'never_arrived', 'late', 'other');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'refunded', 'closed');--> statement-breakpoint
CREATE TABLE "issues" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "issues_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"kind" "issue_kind" NOT NULL,
	"detail" text NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"note" text,
	"refund" integer DEFAULT 0 NOT NULL,
	"resolved_by" integer,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "issues_refund_check" CHECK ("issues"."refund" >= 0),
	CONSTRAINT "issues_resolved_check" CHECK (("issues"."status" = 'open') = ("issues"."resolved_at" is null))
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ratings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"kitchen_id" integer NOT NULL,
	"stars" smallint NOT NULL,
	"comment" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ratings_stars_check" CHECK ("ratings"."stars" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "allergens" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "issue_id" integer;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issues_order_idx" ON "issues" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "issues_status_idx" ON "issues" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "issues_one_open_key" ON "issues" USING btree ("order_id") WHERE "issues"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_order_key" ON "ratings" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ratings_kitchen_idx" ON "ratings" USING btree ("kitchen_id","created_at");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;