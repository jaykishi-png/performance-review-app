-- Enforce "one review cycle per employee per anniversary year" at the database
-- level, so a race between the scheduled cron and a manual admin trigger (or any
-- future code path) can never insert two cycles for the same employee + year.
--
-- If this fails with a "duplicate key value violates unique constraint" style
-- error, it means duplicate (employee_id, anniversary_year) rows already exist —
-- find them first with:
--
--   SELECT employee_id, anniversary_year, count(*)
--   FROM employee_review_cycles
--   GROUP BY employee_id, anniversary_year
--   HAVING count(*) > 1;
--
-- and resolve them (e.g. delete the stale/incorrect duplicate) before re-running
-- this migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_review_cycles_employee_year_unique'
  ) THEN
    ALTER TABLE employee_review_cycles
      ADD CONSTRAINT employee_review_cycles_employee_year_unique UNIQUE (employee_id, anniversary_year);
  END IF;
END $$;
