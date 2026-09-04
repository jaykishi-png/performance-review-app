-- Add the missing foreign keys from the 360 feedback tables to profiles.
--
-- add-peer-feedback.sql created requestor_id / reviewer_id as bare uuid columns
-- with no REFERENCES clause. The API reads these tables with PostgREST embeds
-- that name the constraint explicitly, e.g.
--
--   requestor:profiles!feedback_requests_requestor_id_fkey(name)
--
-- With no such constraint, PostgREST cannot resolve the relationship and every
-- one of those queries fails with PGRST200. That broke the reviewer's emailed
-- feedback link ("Link Not Found"), the admin 360 Feedback list, and the
-- manager's list of sent requests.
--
-- The constraint names below are the ones the queries already hint, so adding
-- them fixes those reads with no code change.
--
-- No ON DELETE action is declared: deleting a profile that still has feedback
-- should fail loudly rather than silently destroy review history. The app
-- deactivates users (is_active) rather than deleting them.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_requests_requestor_id_fkey') THEN
    ALTER TABLE feedback_requests
      ADD CONSTRAINT feedback_requests_requestor_id_fkey
      FOREIGN KEY (requestor_id) REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_requests_reviewer_id_fkey') THEN
    ALTER TABLE feedback_requests
      ADD CONSTRAINT feedback_requests_reviewer_id_fkey
      FOREIGN KEY (reviewer_id) REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'peer_feedback_requestor_id_fkey') THEN
    ALTER TABLE peer_feedback
      ADD CONSTRAINT peer_feedback_requestor_id_fkey
      FOREIGN KEY (requestor_id) REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'peer_feedback_reviewer_id_fkey') THEN
    ALTER TABLE peer_feedback
      ADD CONSTRAINT peer_feedback_reviewer_id_fkey
      FOREIGN KEY (reviewer_id) REFERENCES profiles(id);
  END IF;
END $$;

-- PostgREST caches the schema; reload it so the new relationships are visible
-- immediately rather than after the next restart.
NOTIFY pgrst, 'reload schema';
