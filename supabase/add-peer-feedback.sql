-- Migration: 360 Peer Feedback tables
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/vlyevvangoeoxblnetvh/sql

CREATE TABLE IF NOT EXISTS feedback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requestor_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  year integer NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','submitted','declined')),
  token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  message text DEFAULT '',
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  due_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fr_requestor ON feedback_requests(requestor_id);
CREATE INDEX IF NOT EXISTS idx_fr_reviewer ON feedback_requests(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_fr_token ON feedback_requests(token);

CREATE TABLE IF NOT EXISTS peer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES feedback_requests(id) ON DELETE CASCADE,
  requestor_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  q1_strengths text DEFAULT '',
  q2_improvements text DEFAULT '',
  q3_collab_rating integer CHECK (q3_collab_rating BETWEEN 1 AND 5),
  q3_collab_text text DEFAULT '',
  additional_comments text DEFAULT '',
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pf_request ON peer_feedback(request_id);
CREATE INDEX IF NOT EXISTS idx_pf_requestor ON peer_feedback(requestor_id);
