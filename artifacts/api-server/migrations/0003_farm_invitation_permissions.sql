-- Add permissions column to farm_invitations
-- Allows owners to configure a worker's permissions before they sign in.
-- Nullable: null means use default permissions at sign-in time.
ALTER TABLE farm_invitations ADD COLUMN IF NOT EXISTS permissions jsonb;
