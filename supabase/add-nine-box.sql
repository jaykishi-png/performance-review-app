-- Nine-box grid: store manager-assigned potential rating on each employee profile
alter table profiles
  add column if not exists potential_rating smallint check (potential_rating between 1 and 3);
