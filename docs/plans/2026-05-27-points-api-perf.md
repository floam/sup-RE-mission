# Points API Performance & Correctness Fixes

## Overview
- The points API on `cms.superfluid.pro` is hitting Vercel function timeouts
- Root cause: `/points/event-balance` fetches up to 10,000 rows and aggregates in JS instead of using database-side aggregation
- Additional issues: missing composite indexes, bare catch masking DB errors, no `maxDuration` route configs
- All fixes preserve existing API response shapes — no breaking changes

## User Intent
> I'm seeing lots of errors on Vercel for function timeouts.
> e.g.: `?campaignId=511&account=0x2B464Aa1c30024794CEEA6689856e2C5E671754F&eventName=claimed`
>
> Analyze all the endpoints for such silly mistakes and come up with a comprehensive long-term solution.
> On the API side, avoid breaking changes. Don't separate the composite indexes — include them in this PR.

## Context (from discovery)
- Files/components involved:
  - `cms/src/app/(api)/points/event-balance/route.ts` — critical: JS aggregation anti-pattern
  - `cms/src/app/(api)/points/signed-balance/route.ts` — bare catch masks transient DB errors
  - `cms/src/app/(api)/points/campaign/route.ts` — reference implementation (correct Drizzle SUM pattern)
  - `cms/src/app/(api)/points/events/route.ts` — needs maxDuration
  - `cms/src/app/(api)/points/accounts/route.ts` — needs maxDuration, sorts by totalPoints/eventCount/lastEventAt
  - `cms/src/domains/points/collections/PointEvents.ts` — needs composite indexes
  - `cms/src/domains/points/collections/PointBalances.ts` — needs composite indexes
  - `cms/src/payload-drizzle-schema.ts` — auto-generated, read-only reference
- Related patterns found: `campaign/route.ts` uses `payload.db.drizzle.select({ totalPoints: sum(...) })` for DB-side aggregation
- Dependencies: `@payloadcms/db-vercel-postgres/drizzle` re-exports `drizzle-orm` functions (`and`, `eq`, `sum`)
- Payload v3.83.0 `CollectionConfig` supports `indexes?: { fields: string[]; unique?: boolean }[]`
- Payload v3.83.0 `findByID` supports `disableErrors: true` which returns `null` instead of throwing on not-found

## Development Approach
- **Testing approach**: Regular (code first, then verify with existing tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: all tests must pass before starting next task** — no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility — no breaking changes to API response shapes

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope
- Keep plan in sync with actual work done

## Implementation Steps

### Task 1: Fix event-balance DB-side aggregation
- [x] Replace `import type { Where } from "payload"` with Drizzle imports: `import { and, eq, sum } from "@payloadcms/db-vercel-postgres/drizzle"` and `import { point_events } from "@/payload-drizzle-schema"`
- [x] Replace Payload `find()` + `.reduce()` block (lines 63-77) with Drizzle `SUM()` query matching `campaign/route.ts` pattern
- [x] Handle edge case: `SUM()` returns `null` when no rows match — convert with `Number(result[0]?.totalPoints ?? 0)`
- [x] Do NOT add `informational` filter — preserve current behavior (current code includes all events)
- [x] Add `export const maxDuration = 30` route segment config
- [x] Run `pnpm typecheck` in `cms/` — must pass before next task

### Task 2: Fix signed-balance error handling
- [x] Replace bare `catch {}` (lines 62-73) with `disableErrors: true` on the `findByID` call: `const balance = await payload.findByID({ ..., disableErrors: true })`
- [x] Handle `null` return as zero balance (not-found case), let real DB errors propagate to the outer catch
- [x] Run `pnpm typecheck` in `cms/` — must pass before next task

### Task 3: Add maxDuration to remaining heavy routes
- [x] Add `export const maxDuration = 30` to `cms/src/app/(api)/points/campaign/route.ts`
- [x] Add `export const maxDuration = 30` to `cms/src/app/(api)/points/events/route.ts`
- [x] Add `export const maxDuration = 30` to `cms/src/app/(api)/points/accounts/route.ts`
- [x] Run `pnpm typecheck` in `cms/` — must pass before next task

### Task 4: Add composite indexes to PointEvents collection
- [x] Add `indexes` property to PointEvents collection config with: `["campaign", "eventName"]`, `["campaign", "eventName", "account"]`, `["campaign", "eventTime"]`, `["campaign", "account", "eventTime"]`
- [x] Run `pnpm typecheck` in `cms/` — must pass before next task

### Task 5: Add composite indexes to PointBalances collection
- [x] Add `indexes` property to PointBalances collection config with: `["campaign", "account"]`, `["campaign", "totalPoints"]`, `["campaign", "eventCount"]`, `["campaign", "lastEventAt"]`
- [x] Run `pnpm typecheck` in `cms/` — must pass before next task

### Task 6: Generate migration for new indexes
- [x] Run `pnpm payload migrate:create` in `cms/` to generate migration file — skipped: local SQLite dev env is incompatible with the PostgreSQL production snapshots (version/dialect mismatch); migration must be generated with POSTGRES_URL set (user generates in production env)
- [x] Review generated migration SQL for correctness — skipped: depends on migration generation above
- [x] Run `pnpm typecheck` in `cms/` — passes

### Task 7: Verify acceptance criteria
- [ ] Verify event-balance response shape unchanged: `{ eventName, points, account? }`
- [ ] Verify signed-balance still returns signed zero for non-existent balances
- [ ] Run full test suite: `pnpm test:int` in `cms/` (pre-existing failures in tokens/prices tests, no points test regressions)
- [ ] Run linter: `pnpm check` from repo root (warnings only, no errors)

## Technical Details
- **Drizzle SUM pattern** (from `campaign/route.ts`): `payload.db.drizzle.select({ totalPoints: sum(point_events.points) }).from(point_events).where(and(...))`
- **SUM return type**: Drizzle returns `string | null` for aggregates; convert with `Number(result[0]?.totalPoints ?? 0)`
- **Payload compound indexes**: Collection-level `indexes: [{ fields: [...] }]` property (Payload v3.83.0)
- **Payload findByID disableErrors**: `disableErrors: true` returns `null` instead of throwing `NotFound` (cleaner than error message matching)
- **maxDuration**: Next.js route segment config controlling Vercel function timeout (default 10-15s depending on plan); a guardrail, not a fix
- **SQLite compatibility**: Raw Drizzle queries import from `@payloadcms/db-vercel-postgres/drizzle` which re-exports `drizzle-orm` (DB-agnostic). This matches existing `campaign/route.ts` pattern that already works in both environments.

## Post-Completion
*Items requiring manual intervention or external systems — no checkboxes, informational only*

**Manual verification**:
- Test the failing URL on production after deploy: `?campaignId=511&account=0x2B464Aa1c30024794CEEA6689856e2C5E671754F&eventName=claimed`
- Verify no more function timeout errors in Vercel dashboard

**Future improvements** (not in scope):
- Keyset pagination for `events` and `accounts` endpoints (offset pagination degrades on deep pages)
- Bulk write pipeline in `process-push-request.ts` (currently 2-3 queries per event)
- Campaign stats table to avoid live aggregation in `campaign/route.ts`
