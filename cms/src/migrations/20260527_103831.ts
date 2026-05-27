import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE INDEX "campaign_eventName_idx" ON "point_events" USING btree ("campaign_id","event_name");
  CREATE INDEX "campaign_eventName_account_idx" ON "point_events" USING btree ("campaign_id","event_name","account");
  CREATE INDEX "campaign_eventTime_idx" ON "point_events" USING btree ("campaign_id","event_time");
  CREATE INDEX "campaign_account_eventTime_idx" ON "point_events" USING btree ("campaign_id","account","event_time");
  CREATE INDEX "campaign_account_idx" ON "point_balances" USING btree ("campaign_id","account");
  CREATE INDEX "campaign_totalPoints_idx" ON "point_balances" USING btree ("campaign_id","total_points");
  CREATE INDEX "campaign_eventCount_idx" ON "point_balances" USING btree ("campaign_id","event_count");
  CREATE INDEX "campaign_lastEventAt_idx" ON "point_balances" USING btree ("campaign_id","last_event_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "campaign_eventName_idx";
  DROP INDEX "campaign_eventName_account_idx";
  DROP INDEX "campaign_eventTime_idx";
  DROP INDEX "campaign_account_eventTime_idx";
  DROP INDEX "campaign_account_idx";
  DROP INDEX "campaign_totalPoints_idx";
  DROP INDEX "campaign_eventCount_idx";
  DROP INDEX "campaign_lastEventAt_idx";`)
}
