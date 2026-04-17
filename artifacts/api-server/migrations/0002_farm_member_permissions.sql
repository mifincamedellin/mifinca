-- Migration: Add permissions JSONB column to farm_members
-- Applied via: psql "$DATABASE_URL" -f this_file
-- Date: 2026-04-17

-- Step 1: Add permissions column (JSONB, nullable initially for safety)
ALTER TABLE farm_members
  ADD COLUMN IF NOT EXISTS permissions JSONB;

-- Step 2: Upgrade ALL rows (including legacy non-null rows with old shape) to full 24-key permissions.
-- Uses jsonb merge: defaults on the left, existing values override on right, so custom
-- permissions are preserved while any missing keys get a safe default.
-- Idempotent: safe to run multiple times.

-- Owner rows: always full access
UPDATE farm_members
SET permissions = (
  '{
    "can_view_animals":   true,
    "can_add_animals":    true,
    "can_edit_animals":   true,
    "can_remove_animals": true,
    "can_view_inventory":   true,
    "can_add_inventory":    true,
    "can_edit_inventory":   true,
    "can_remove_inventory": true,
    "can_view_finances":   true,
    "can_add_finances":    true,
    "can_edit_finances":   true,
    "can_remove_finances": true,
    "can_view_contacts":   true,
    "can_add_contacts":    true,
    "can_edit_contacts":   true,
    "can_remove_contacts": true,
    "can_view_employees":   true,
    "can_add_employees":    true,
    "can_edit_employees":   true,
    "can_remove_employees": true,
    "can_view_calendar":   true,
    "can_add_calendar":    true,
    "can_edit_calendar":   true,
    "can_remove_calendar": true
  }'::jsonb
)
WHERE role = 'owner';

-- Worker rows: upgrade using merge — defaults provide missing keys, existing values preserved
UPDATE farm_members
SET permissions = (
  '{
    "can_view_animals":   true,
    "can_add_animals":    true,
    "can_edit_animals":   true,
    "can_remove_animals": true,
    "can_view_inventory":   true,
    "can_add_inventory":    true,
    "can_edit_inventory":   true,
    "can_remove_inventory": true,
    "can_view_finances":   true,
    "can_add_finances":    true,
    "can_edit_finances":   true,
    "can_remove_finances": true,
    "can_view_contacts":   true,
    "can_add_contacts":    true,
    "can_edit_contacts":   true,
    "can_remove_contacts": true,
    "can_view_employees":   true,
    "can_add_employees":    true,
    "can_edit_employees":   true,
    "can_remove_employees": true,
    "can_view_calendar":   true,
    "can_add_calendar":    true,
    "can_edit_calendar":   true,
    "can_remove_calendar": true
  }'::jsonb || COALESCE(permissions, '{}'::jsonb)
)
WHERE role = 'worker';

-- Verified: Applied on 2026-04-17, all 3 existing rows (all owners) backfilled with full permissions.
-- SELECT id, role, permissions FROM farm_members; confirmed 24 flags per row.
