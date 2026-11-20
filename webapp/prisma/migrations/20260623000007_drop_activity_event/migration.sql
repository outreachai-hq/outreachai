-- Drop the legacy contact-level ActivityEvent table.
--
-- Replaced by LeadActivity (Plan 4), which carries the same events with a
-- richer schema (type catalog + payload + contactId/leadId/companyId
-- pointers). The two former writers (POST /api/contacts and PATCH
-- /api/contacts/by-profile) now emit through lib/activity.ts; the /activity
-- page reads from /api/activities backed by LeadActivity.
--
-- Destructive: every ActivityEvent row goes away. The data was a transient
-- audit log (no UI relied on historical pre-migration entries surviving).
-- IF EXISTS keeps the migration idempotent across environments.

DROP TABLE IF EXISTS "ActivityEvent";
