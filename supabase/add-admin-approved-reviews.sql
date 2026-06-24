alter table reviews
  add column if not exists admin_approved_at timestamptz,
  add column if not exists admin_approved_by uuid references profiles(id);
