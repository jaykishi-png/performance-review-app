alter table reviews
  add column if not exists meeting_confirmed_at timestamptz;
