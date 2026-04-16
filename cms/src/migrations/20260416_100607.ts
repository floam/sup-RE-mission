import { type MigrateDownArgs, type MigrateUpArgs, sql } from "@payloadcms/db-vercel-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
	await db.execute(sql`
   DROP TABLE "point_balances_rels" CASCADE;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
	await db.execute(sql`
   CREATE TABLE "point_balances_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"point_events_id" integer
  );
  
  ALTER TABLE "point_balances_rels" ADD CONSTRAINT "point_balances_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."point_balances"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "point_balances_rels" ADD CONSTRAINT "point_balances_rels_point_events_fk" FOREIGN KEY ("point_events_id") REFERENCES "public"."point_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "point_balances_rels_order_idx" ON "point_balances_rels" USING btree ("order");
  CREATE INDEX "point_balances_rels_parent_idx" ON "point_balances_rels" USING btree ("parent_id");
  CREATE INDEX "point_balances_rels_path_idx" ON "point_balances_rels" USING btree ("path");
  CREATE INDEX "point_balances_rels_point_events_id_idx" ON "point_balances_rels" USING btree ("point_events_id");`)
}
