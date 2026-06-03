-- Add new columns to self_reviews to match the official template structure
ALTER TABLE self_reviews
  ADD COLUMN IF NOT EXISTS competencies jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS goals_objectives jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_year_goals jsonb DEFAULT '[]'::jsonb;
