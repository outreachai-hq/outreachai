-- Drop the legacy LinkedIn-only InboxThread table.
--
-- Plan 2 (the Conversation + Message tables) now stores every channel of
-- inbound message, and the backfill in scripts/backfill-conversations.ts
-- mirrored every historical InboxThread row into Conversation. The Chrome
-- extension's POST /api/inbox/sync no longer writes here.
--
-- This is destructive — the InboxThread table and all its rows go away.
-- migrate-prod.ts applies this statement-by-statement; `IF EXISTS` makes
-- the migration idempotent if it has already been applied locally.

DROP TABLE IF EXISTS "InboxThread";
