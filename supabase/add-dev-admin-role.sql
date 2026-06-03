-- Add dev_admin role to profiles and invites tables
-- Run this in Supabase SQL editor

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'dev_admin', 'manager', 'employee', 'pending'));

ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_role_check;
ALTER TABLE invites ADD CONSTRAINT invites_role_check
  CHECK (role IN ('admin', 'dev_admin', 'manager', 'employee'));

-- Assign dev_admin to automation@rushmediateam.com
UPDATE profiles
SET role = 'dev_admin'
WHERE email = 'automation@rushmediateam.com';
