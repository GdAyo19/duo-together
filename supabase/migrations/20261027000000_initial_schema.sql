create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 50),
  language text not null default 'fr' check (language in ('fr', 'es', 'it')),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  joined_at timestamptz not null default now(),
  unique (couple_id, user_id)
);

create table if not exists public.practice_days (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  practiced_on date not null default (now() at time zone 'utc')::date,
  words_learned integer not null default 3 check (words_learned between 1 and 3),
  minutes integer not null default 5 check (minutes = 5),
  completed_at timestamptz not null default now(),
  unique (couple_id, user_id, practiced_on)
);

create table if not exists public.saved_phrases (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  saved_by uuid not null references auth.users(id) on delete cascade,
  language text not null check (language in ('fr', 'es', 'it')),
  phrase text not null check (char_length(phrase) between 1 and 120),
  translation text not null check (char_length(translation) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (couple_id, language, phrase)
);

create index if not exists practice_days_couple_date_idx
  on public.practice_days (couple_id, practiced_on desc);
create index if not exists saved_phrases_couple_created_idx
  on public.saved_phrases (couple_id, created_at desc);

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.couple_members
    where couple_id = target_couple_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_couple_member(uuid) from public;
grant execute on function public.is_couple_member(uuid) to authenticated;

create or replace function public.create_couple(p_name text, p_display_name text, p_language text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_couple public.couples;
begin
  if auth.uid() is null then
    raise exception 'Sign in before creating a couple space.';
  end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a couple space.';
  end if;
  if char_length(trim(p_name)) not between 2 and 50
     or char_length(trim(p_display_name)) not between 1 and 32 then
    raise exception 'Enter a couple name and a display name.';
  end if;
  if p_language not in ('fr', 'es', 'it') then
    raise exception 'Choose a supported language.';
  end if;

  insert into public.couples (name, language, created_by)
  values (trim(p_name), p_language, auth.uid())
  returning * into new_couple;

  insert into public.couple_members (couple_id, user_id, display_name)
  values (new_couple.id, auth.uid(), trim(p_display_name));

  return jsonb_build_object(
    'id', new_couple.id,
    'name', new_couple.name,
    'language', new_couple.language,
    'invite_code', new_couple.invite_code
  );
end;
$$;

create or replace function public.join_couple_by_code(p_code text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_couple public.couples;
begin
  if auth.uid() is null then
    raise exception 'Sign in before joining a couple space.';
  end if;
  if char_length(trim(p_display_name)) not between 1 and 32 then
    raise exception 'Enter a display name.';
  end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a couple space.';
  end if;

  select * into selected_couple
  from public.couples
  where invite_code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'That invite code was not found.';
  end if;
  if (select count(*) from public.couple_members where couple_id = selected_couple.id) >= 2 then
    raise exception 'This couple space already has two members.';
  end if;

  insert into public.couple_members (couple_id, user_id, display_name)
  values (selected_couple.id, auth.uid(), trim(p_display_name));

  return jsonb_build_object(
    'id', selected_couple.id,
    'name', selected_couple.name,
    'language', selected_couple.language,
    'invite_code', selected_couple.invite_code
  );
end;
$$;

revoke all on function public.create_couple(text, text, text) from public;
revoke all on function public.join_couple_by_code(text, text) from public;
grant execute on function public.create_couple(text, text, text) to authenticated;
grant execute on function public.join_couple_by_code(text, text) to authenticated;

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.practice_days enable row level security;
alter table public.saved_phrases enable row level security;

drop policy if exists "Members can read their couple" on public.couples;
create policy "Members can read their couple"
  on public.couples for select to authenticated
  using (public.is_couple_member(id));

drop policy if exists "Members can update their couple" on public.couples;
create policy "Members can update their couple"
  on public.couples for update to authenticated
  using (public.is_couple_member(id))
  with check (public.is_couple_member(id));

drop policy if exists "Members can read their couple members" on public.couple_members;
create policy "Members can read their couple members"
  on public.couple_members for select to authenticated
  using (user_id = auth.uid() or public.is_couple_member(couple_id));

drop policy if exists "Members can read shared practice" on public.practice_days;
create policy "Members can read shared practice"
  on public.practice_days for select to authenticated
  using (public.is_couple_member(couple_id));

drop policy if exists "Users can record their own practice today" on public.practice_days;
create policy "Users can record their own practice today"
  on public.practice_days for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_couple_member(couple_id)
    and practiced_on = (now() at time zone 'utc')::date
    and words_learned between 1 and 3
    and minutes = 5
  );

drop policy if exists "Members can read saved phrases" on public.saved_phrases;
create policy "Members can read saved phrases"
  on public.saved_phrases for select to authenticated
  using (public.is_couple_member(couple_id));

drop policy if exists "Members can save shared phrases" on public.saved_phrases;
create policy "Members can save shared phrases"
  on public.saved_phrases for insert to authenticated
  with check (saved_by = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "Members can remove shared phrases" on public.saved_phrases;
create policy "Members can remove shared phrases"
  on public.saved_phrases for delete to authenticated
  using (public.is_couple_member(couple_id));

grant select on public.couples to authenticated;
grant update (name, language) on public.couples to authenticated;
grant select on public.couple_members to authenticated;
grant select, insert on public.practice_days to authenticated;
grant select, insert, delete on public.saved_phrases to authenticated;
