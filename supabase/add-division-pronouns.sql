-- Add division and pronouns to profiles
alter table profiles add column if not exists division text;
alter table profiles add column if not exists pronouns text;
