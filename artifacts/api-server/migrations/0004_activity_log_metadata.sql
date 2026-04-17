-- Add metadata column to activity_log for structured contextual data.
-- Nullable jsonb; existing rows will have NULL (safe to apply to live DB).
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS metadata jsonb;
