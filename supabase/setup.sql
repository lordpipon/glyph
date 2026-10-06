-- ------------------------------------------------------------------
-- Glyph account extras
--
-- Run this once in Supabase → SQL Editor ("New query", paste, Run).
-- It adds everything the app needs beyond plain email/password auth:
--
--   1. `profiles` — a public table that maps usernames to emails, so signing
--      in with a username works and shared notes can say "Shared by <name>".
--   2. `delete_account()` — the endpoint behind Settings → Delete account.
--   3. `lookup_email()` — the lookup the sign-in form calls for a username.
--
-- It is safe to re-run: everything is CREATE OR REPLACE / IF NOT EXISTS.
-- ------------------------------------------------------------------

-- The trigger below creates the row at sign-up from Auth metadata
-- (username is stored in user_metadata by the register form).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  email text not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Public rows: usernames are how share links and sign-in identify people.
create policy "profiles are readable by everyone"
  on public.profiles for select
  using (true);

-- The registered reader can write their own row (username changes, etc.)
create policy "a reader can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "a reader can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Keep the table in step with new sign-ups. Usernames arrive as
-- raw_user_meta_data['username']; fall back to the part before the @ if a
-- pre-existing account (created before usernames existed) signs up again.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username',
             split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Settings → Delete account. The reader can only ever reach their own row.
create or replace function public.delete_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

-- The sign-in form resolves "someone" → an email without exposing the table.
create or replace function public.lookup_email(target_username text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select email from public.profiles
  where username = target_username
  limit 1;
$$;