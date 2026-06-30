-- Allow multiple self-reviews per employee (one per cycle year)
ALTER TABLE self_reviews ADD COLUMN IF NOT EXISTS anniversary_year int;

-- Backfill existing records with the year they were submitted/updated
UPDATE self_reviews
SET anniversary_year = EXTRACT(YEAR FROM COALESCE(submitted_at, updated_at))::int
WHERE anniversary_year IS NULL;
