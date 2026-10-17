-- Give each account multiple named household pictures while preserving its
-- existing picture as the default Main picture.
alter table public.user_pictures
  add column id uuid default gen_random_uuid(),
  add column name text not null default 'Main picture',
  add column is_main boolean not null default true;

alter table public.user_pictures
  alter column id set not null,
  drop constraint user_pictures_pkey,
  add constraint user_pictures_pkey primary key (id),
  add constraint user_pictures_name_valid
    check (length(btrim(name)) between 1 and 60);

create unique index user_pictures_one_main_per_user
  on public.user_pictures (user_id)
  where is_main;

create unique index user_pictures_unique_name_per_user
  on public.user_pictures (user_id, lower(name));
