-- Backfill self_reviews.anniversary_year from the employee's review cycles.
--
-- add-sa-anniversary-year.sql added the column and did a one-off backfill using
-- EXTRACT(YEAR FROM submitted_at). That is wrong for anyone whose anniversary
-- sits near a year boundary (an assessment submitted in December for a January
-- anniversary belongs to the following year's cycle), and it left every row
-- created after it ran unlabelled, because the API wasn't setting the column.
--
-- Match each unlabelled assessment to the cycle whose self-assessment window it
-- falls in — the latest cycle whose sa_open_at is at or before the assessment's
-- timestamp. Cycles are the source of truth for which annual period is which.

UPDATE self_reviews sr
SET anniversary_year = c.anniversary_year
FROM (
  SELECT DISTINCT ON (erc.employee_id, sr2.id)
    sr2.id AS self_review_id,
    erc.anniversary_year
  FROM self_reviews sr2
  JOIN employee_review_cycles erc
    ON erc.employee_id = sr2.employee_id
   AND erc.sa_open_at <= COALESCE(sr2.submitted_at, sr2.updated_at, sr2.created_at)
  WHERE sr2.anniversary_year IS NULL
  ORDER BY erc.employee_id, sr2.id, erc.sa_open_at DESC
) c
WHERE sr.id = c.self_review_id
  AND sr.anniversary_year IS NULL;

-- Any assessment predating its employee's earliest cycle window has no cycle to
-- match; fall back to the employee's single cycle when they only have one.
UPDATE self_reviews sr
SET anniversary_year = c.anniversary_year
FROM (
  SELECT erc.employee_id, MIN(erc.anniversary_year) AS anniversary_year
  FROM employee_review_cycles erc
  GROUP BY erc.employee_id
  HAVING COUNT(*) = 1
) c
WHERE sr.employee_id = c.employee_id
  AND sr.anniversary_year IS NULL;

-- Verify: should return zero rows for employees who have any cycle.
--   SELECT sr.id, sr.employee_id, sr.submitted_at
--   FROM self_reviews sr
--   WHERE sr.anniversary_year IS NULL;
