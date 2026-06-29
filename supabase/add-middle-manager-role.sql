-- Add middle_manager role to profiles and invites check constraints
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'dev_admin', 'manager', 'middle_manager', 'employee', 'pending'));

ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_role_check;
ALTER TABLE invites ADD CONSTRAINT invites_role_check
  CHECK (role IN ('admin', 'dev_admin', 'manager', 'middle_manager', 'employee'));
