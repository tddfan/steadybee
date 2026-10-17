-- One current Steadybee picture per account.
-- Apply only after creating the Supabase project and before enabling cloud saves.
-- The application uses the public/publishable client key; row ownership is enforced here.

create table if not exists public.user_pictures (
  user_id uuid primary key references auth.users (id) on delete cascade,
  picture jsonb not null,
  updated_at timestamptz not null default now(),
  constraint user_pictures_picture_object check (jsonb_typeof(picture) = 'object')
);

alter table public.user_pictures enable row level security;

revoke all on table public.user_pictures from anon;
grant select, insert, update, delete on table public.user_pictures to authenticated;

drop policy if exists "Users can read their own picture" on public.user_pictures;
create policy "Users can read their own picture"
  on public.user_pictures for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own picture" on public.user_pictures;
create policy "Users can create their own picture"
  on public.user_pictures for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own picture" on public.user_pictures;
create policy "Users can update their own picture"
  on public.user_pictures for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own picture" on public.user_pictures;
create policy "Users can delete their own picture"
  on public.user_pictures for delete
  to authenticated
  using ((select auth.uid()) = user_id);
