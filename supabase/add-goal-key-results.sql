alter table employee_goals
  add column if not exists key_results jsonb default '[]';
