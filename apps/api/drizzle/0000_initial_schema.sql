CREATE TYPE "public"."order_status" AS ENUM('placed', 'accepted', 'cooking', 'ready', 'picked_up', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash');--> statement-breakpoint
CREATE TYPE "public"."promotion_kind" AS ENUM('free_delivery', 'amount_off', 'percent_off');--> statement-breakpoint
CREATE TYPE "public"."promotion_payer" AS ENUM('platform', 'restaurant');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"sort" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuisines" (
	"id" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"tone" text NOT NULL,
	"photo" text,
	"sort" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_cuisines" (
	"kitchen_id" integer NOT NULL,
	"cuisine_id" text NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "kitchen_cuisines_kitchen_id_cuisine_id_pk" PRIMARY KEY("kitchen_id","cuisine_id")
);
--> statement-breakpoint
CREATE TABLE "kitchens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kitchens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"tagline_en" text NOT NULL,
	"tagline_bn" text NOT NULL,
	"area_id" text NOT NULL,
	"address_en" text NOT NULL,
	"address_bn" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"prep_minutes" smallint NOT NULL,
	"min_order" integer NOT NULL,
	"on_time_of_ten" smallint NOT NULL,
	"opens_minute" smallint NOT NULL,
	"closes_minute" smallint NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"tone" text NOT NULL,
	"photo" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "kitchens_min_order_check" CHECK ("kitchens"."min_order" >= 0),
	CONSTRAINT "kitchens_prep_check" CHECK ("kitchens"."prep_minutes" > 0),
	CONSTRAINT "kitchens_on_time_check" CHECK ("kitchens"."on_time_of_ten" between 0 and 10),
	CONSTRAINT "kitchens_hours_check" CHECK ("kitchens"."opens_minute" between 0 and 1439 and "kitchens"."closes_minute" between 0 and 1439)
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kitchen_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"description_bn" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"photo" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"sort" smallint NOT NULL,
	CONSTRAINT "menu_items_price_check" CHECK ("menu_items"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "menu_sections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_sections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kitchen_id" integer NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"sort" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"status" "order_status" NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"minute" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"menu_item_id" integer NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"unit_price" integer NOT NULL,
	"quantity" smallint NOT NULL,
	"line_total" integer NOT NULL,
	CONSTRAINT "order_lines_quantity_check" CHECK ("order_lines"."quantity" > 0),
	CONSTRAINT "order_lines_total_check" CHECK ("order_lines"."line_total" = "order_lines"."unit_price" * "order_lines"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"token" text NOT NULL,
	"idempotency_key" text,
	"kitchen_id" integer NOT NULL,
	"area_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"address" text NOT NULL,
	"note" text,
	"payment_method" "payment_method" NOT NULL,
	"promo_code" text,
	"items_total" integer NOT NULL,
	"discount" integer NOT NULL,
	"delivery_fee" integer NOT NULL,
	"delivery_discount" integer NOT NULL,
	"service_fee" integer NOT NULL,
	"vat" integer NOT NULL,
	"total" integer NOT NULL,
	"window_min" smallint NOT NULL,
	"window_max" smallint NOT NULL,
	"time_scale" smallint DEFAULT 1 NOT NULL,
	"placed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "orders_amounts_check" CHECK ("orders"."items_total" > 0 and "orders"."discount" between 0 and "orders"."items_total"
        and "orders"."delivery_fee" >= 0
        and "orders"."delivery_discount" between 0 and "orders"."delivery_fee"
        and "orders"."service_fee" >= 0 and "orders"."vat" >= 0),
	CONSTRAINT "orders_total_check" CHECK ("orders"."total" = "orders"."items_total" - "orders"."discount" + "orders"."delivery_fee"
        - "orders"."delivery_discount" + "orders"."service_fee" + "orders"."vat"),
	CONSTRAINT "orders_window_check" CHECK ("orders"."window_min" > 0 and "orders"."window_max" > "orders"."window_min"),
	CONSTRAINT "orders_time_scale_check" CHECK ("orders"."time_scale" >= 1)
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promotions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"title_en" text NOT NULL,
	"title_bn" text NOT NULL,
	"terms_en" text NOT NULL,
	"terms_bn" text NOT NULL,
	"kind" "promotion_kind" NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"max_discount" integer,
	"min_subtotal" integer DEFAULT 0 NOT NULL,
	"kitchen_id" integer,
	"cuisine_id" text,
	"starts_minute" smallint,
	"ends_minute" smallint,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"paid_by" "promotion_payer" NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "promotions_value_check" CHECK ("promotions"."value" >= 0),
	CONSTRAINT "promotions_hours_check" CHECK (("promotions"."starts_minute" is null) = ("promotions"."ends_minute" is null))
);
--> statement-breakpoint
ALTER TABLE "kitchen_cuisines" ADD CONSTRAINT "kitchen_cuisines_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_cuisines" ADD CONSTRAINT "kitchen_cuisines_cuisine_id_cuisines_id_fk" FOREIGN KEY ("cuisine_id") REFERENCES "public"."cuisines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchens" ADD CONSTRAINT "kitchens_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_section_id_menu_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."menu_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_sections" ADD CONSTRAINT "menu_sections_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_cuisine_id_cuisines_id_fk" FOREIGN KEY ("cuisine_id") REFERENCES "public"."cuisines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kitchens_slug_key" ON "kitchens" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "kitchens_area_idx" ON "kitchens" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "menu_items_kitchen_idx" ON "menu_items" USING btree ("kitchen_id");--> statement-breakpoint
CREATE INDEX "menu_sections_kitchen_idx" ON "menu_sections" USING btree ("kitchen_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_events_order_status_key" ON "order_events" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "order_events_order_at_idx" ON "order_events" USING btree ("order_id","at");--> statement-breakpoint
CREATE INDEX "order_lines_order_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_public_id_key" ON "orders" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_token_key" ON "orders" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "orders_placed_idx" ON "orders" USING btree ("placed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions" USING btree ("code");