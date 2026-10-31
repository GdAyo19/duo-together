-- Streaks follow the shared space's own day instead of always using UTC, and
-- practice rows remember which lesson phrases they covered so repeated phrases
-- are not counted twice as "words learned".
alter table public.couples
  add column if not exists timezone text not null default 'UTC';

alter table public.practice_days
  add column if not exists phrase_keys text[] not null default '{}';

alter table public.practice_days
  drop constraint if exists practice_days_phrase_keys_check;

alter table public.practice_days
  add constraint practice_days_phrase_keys_check
  check (coalesce(array_length(phrase_keys, 1), 0) <= 3);

create or replace function public.couple_today(target_couple_id uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (now() at time zone coalesce(
    (select timezone from public.couples where id = target_couple_id),
    'UTC'
  ))::date;
$$;

revoke all on function public.couple_today(uuid) from public;
grant execute on function public.couple_today(uuid) to authenticated;

drop policy if exists "Users can record their own practice today" on public.practice_days;
create policy "Users can record their own practice today"
  on public.practice_days for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_couple_member(couple_id)
    and practiced_on = public.couple_today(couple_id)
    and words_learned between 1 and 3
    and minutes = 5
  );

create or replace function public.get_couple_progress(p_couple_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with recursive
  today as (
    select public.couple_today(p_couple_id) as practiced_on
  ),
  daily as (
    select
      practiced_on,
      count(distinct user_id) as member_count
    from public.practice_days
    where couple_id = p_couple_id
    group by practiced_on
  ),
  streak_days(practiced_on) as (
    select max(daily.practiced_on)
    from daily, today
    where daily.member_count = 2
      and daily.practiced_on between today.practiced_on - 1 and today.practiced_on

    union all

    select daily.practiced_on
    from streak_days
    join daily on daily.practiced_on = streak_days.practiced_on - 1
      and daily.member_count = 2
    where streak_days.practiced_on is not null
  )
  select jsonb_build_object(
    'streak', (select count(*) from streak_days where practiced_on is not null),
    'words_learned', (
      select coalesce(count(distinct phrase_key), 0)
      from public.practice_days as practice, unnest(practice.phrase_keys) as phrase_key
      where practice.couple_id = p_couple_id
    ) + 3 * (
      select count(distinct practiced_on)
      from public.practice_days
      where couple_id = p_couple_id
        and coalesce(array_length(phrase_keys, 1), 0) = 0
    ),
    'minutes_today', (
      select coalesce(sum(practice.minutes), 0)
      from public.practice_days as practice, today
      where practice.couple_id = p_couple_id
        and practice.practiced_on = today.practiced_on
    ),
    'today_user_ids', coalesce((
      select jsonb_agg(practice.user_id)
      from public.practice_days as practice, today
      where practice.couple_id = p_couple_id
        and practice.practiced_on = today.practiced_on
    ), '[]'::jsonb),
    -- Phrases covered on earlier days, so the next lesson avoids repeats.
    -- Today's own phrases are excluded so the lesson stays fixed after it is
    -- completed instead of reshuffling the moment practice is recorded.
    'seen_phrase_keys', coalesce((
      select jsonb_agg(distinct phrase_key)
      from public.practice_days as practice, today, unnest(practice.phrase_keys) as phrase_key
      where practice.couple_id = p_couple_id
        and practice.practiced_on < today.practiced_on
    ), '[]'::jsonb)
  );
$$;

create or replace function public.set_couple_timezone(p_timezone text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_couple_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before changing your space.';
  end if;
  if p_timezone is null
     or p_timezone = ''
     or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'That time zone is not recognised.';
  end if;

  select couple_id into target_couple_id
  from public.couple_members
  where user_id = auth.uid();

  if target_couple_id is null then
    raise exception 'Create or join a shared space first.';
  end if;

  update public.couples set timezone = p_timezone where id = target_couple_id;
  return jsonb_build_object('timezone', p_timezone);
end;
$$;

create or replace function public.regenerate_invite_code()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_couple_id uuid;
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before changing your invite code.';
  end if;

  select couple_id into target_couple_id
  from public.couple_members
  where user_id = auth.uid();

  if target_couple_id is null then
    raise exception 'Create or join a shared space first.';
  end if;

  update public.couples
  set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
  where id = target_couple_id
  returning invite_code into new_code;

  return jsonb_build_object('invite_code', new_code);
end;
$$;

create or replace function public.leave_couple()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_couple_id uuid;
  remaining integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before leaving a space.';
  end if;

  select couple_id into target_couple_id
  from public.couple_members
  where user_id = auth.uid();

  if target_couple_id is null then
    raise exception 'You are not in a shared space.';
  end if;

  delete from public.practice_days where user_id = auth.uid();
  delete from public.couple_members where user_id = auth.uid();

  select count(*) into remaining from public.couple_members where couple_id = target_couple_id;
  if remaining = 0 then
    delete from public.couples where id = target_couple_id;
  end if;

  return jsonb_build_object('left', true, 'space_removed', remaining = 0);
end;
$$;

create or replace function public.delete_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_couple_id uuid;
  remaining integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before deleting your data.';
  end if;

  select couple_id into target_couple_id
  from public.couple_members
  where user_id = auth.uid();

  delete from public.practice_days where user_id = auth.uid();
  delete from public.saved_phrases where saved_by = auth.uid();

  if target_couple_id is not null then
    delete from public.couple_members where user_id = auth.uid();
    select count(*) into remaining from public.couple_members where couple_id = target_couple_id;
    if remaining = 0 then
      delete from public.couples where id = target_couple_id;
    end if;
  end if;

  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.set_couple_timezone(text) from public;
revoke all on function public.regenerate_invite_code() from public;
revoke all on function public.leave_couple() from public;
revoke all on function public.delete_my_data() from public;
grant execute on function public.set_couple_timezone(text) to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.leave_couple() to authenticated;
grant execute on function public.delete_my_data() to authenticated;
