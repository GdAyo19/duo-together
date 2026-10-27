create or replace function public.get_couple_progress(p_couple_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with recursive
  today as (
    select (now() at time zone 'utc')::date as practiced_on
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
      select count(distinct practiced_on) * 3
      from public.practice_days
      where couple_id = p_couple_id
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
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_couple_progress(uuid) from public;
grant execute on function public.get_couple_progress(uuid) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['practice_days', 'saved_phrases', 'couples', 'couple_members']
  loop
    if exists (
      select 1
      from pg_publication
      where pubname = 'supabase_realtime'
    ) and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
