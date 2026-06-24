-- Add Google Drive folder URLs to app_settings so they are shared across all users
alter table app_settings
  add column if not exists drive_folder_url text,
  add column if not exists sa_drive_folder_url text,
  add column if not exists org_name text;
