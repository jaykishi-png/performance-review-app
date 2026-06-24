-- Add deadline reminder tracking columns to employee_review_cycles
alter table employee_review_cycles
  add column if not exists notif_sa_halfway_sent_at     timestamptz,
  add column if not exists notif_sa_3day_sent_at        timestamptz,
  add column if not exists notif_sa_1day_sent_at        timestamptz,
  add column if not exists notif_review_halfway_sent_at timestamptz,
  add column if not exists notif_review_3day_sent_at    timestamptz,
  add column if not exists notif_review_1day_sent_at    timestamptz,
  add column if not exists notif_meeting_3day_sent_at   timestamptz,
  add column if not exists notif_meeting_1day_sent_at   timestamptz;
