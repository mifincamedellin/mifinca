-- Migration: Add permissions JSONB column to farm_members
-- Applied via: psql "$DATABASE_URL" -f this_file
-- Date: 2026-04-17

-- Step 1: Add permissions column (JSONB, nullable initially for safety)
ALTER TABLE farm_members
  ADD COLUMN IF NOT EXISTS permissions JSONB;

-- Step 2: Backfill existing owner members with full permissions
UPDATE farm_members
SET permissions = '{
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
WHERE permissions IS NULL AND role = 'owner';

-- Step 3: Backfill existing worker members with full permissions (owners of their farm tasks)
UPDATE farm_members
SET permissions = '{
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
WHERE permissions IS NULL AND role = 'worker';

-- Verified: Applied on 2026-04-17, all 3 existing rows (all owners) backfilled with full permissions.
-- SELECT id, role, permissions FROM farm_members; confirmed 24 flags per row.
