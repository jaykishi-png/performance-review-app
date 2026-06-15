-- App settings table (single row, keyed by org)
create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  smtp_email text,
  smtp_password text,
  smtp_display_name text default 'Performance Review',
  updated_at timestamptz default now()
);

-- Only one row ever exists
insert into app_settings (smtp_email, smtp_password, smtp_display_name)
values (null, null, 'Performance Review')
on conflict do nothing;
