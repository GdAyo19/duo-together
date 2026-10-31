alter table public.couple_members
  add column if not exists avatar_url text;

alter table public.couple_members
  add column if not exists profile_updated_at timestamptz;

alter table public.couple_members
  drop constraint if exists couple_members_avatar_url_check;

alter table public.couple_members
  add constraint couple_members_avatar_url_check
  check (
    avatar_url is null
    or avatar_url ~ '^https://[^[:space:]]+/storage/v1/object/public/avatars/[^[:space:]]+$'
  );

create or replace function public.update_my_profile(p_display_name text, p_avatar_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_member public.couple_members;
begin
  if auth.uid() is null then
    raise exception 'Sign in before updating your profile.';
  end if;
  if char_length(trim(coalesce(p_display_name, ''))) not between 1 and 32 then
    raise exception 'Choose a nickname between 1 and 32 characters.';
  end if;
  if p_avatar_url is not null
     and p_avatar_url !~ '^https://[^[:space:]]+/storage/v1/object/public/avatars/[^[:space:]]+$' then
    raise exception 'That profile photo address is not allowed.';
  end if;

  update public.couple_members
  set display_name = trim(p_display_name),
      avatar_url = p_avatar_url,
      profile_updated_at = now()
  where user_id = auth.uid()
  returning * into updated_member;

  if updated_member.id is null then
    raise exception 'Join a shared space before updating your profile.';
  end if;

  return jsonb_build_object(
    'display_name', updated_member.display_name,
    'avatar_url', updated_member.avatar_url
  );
end;
$$;

revoke all on function public.update_my_profile(text, text) from public;
grant execute on function public.update_my_profile(text, text) to authenticated;

grant update (display_name, avatar_url, profile_updated_at) on public.couple_members to authenticated;

drop policy if exists "Members can update their own profile" on public.couple_members;
create policy "Members can update their own profile"
  on public.couple_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Members can upload their own avatar" on storage.objects;
create policy "Members can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members can replace their own avatar" on storage.objects;
create policy "Members can replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Members can remove their own avatar" on storage.objects;
create policy "Members can remove their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
