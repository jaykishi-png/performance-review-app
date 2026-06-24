alter table one_on_one_notes
  add column if not exists is_shared boolean default false;
