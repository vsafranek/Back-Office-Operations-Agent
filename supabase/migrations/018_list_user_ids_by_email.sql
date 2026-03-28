-- Pouze service_role (Next.js admin klient). Slouží ke sloučení dat uživatelů se stejným e-mailem.
create or replace function public.list_user_ids_for_email(lookup_email text)
returns table (user_id uuid)
language sql
security definer
set search_path = auth
stable
as $$
  select u.id as user_id
  from auth.users u
  where u.email is not null
    and lower(trim(u.email)) = lower(trim(lookup_email));
$$;

revoke all on function public.list_user_ids_for_email(text) from public;
revoke all on function public.list_user_ids_for_email(text) from anon;
revoke all on function public.list_user_ids_for_email(text) from authenticated;
grant execute on function public.list_user_ids_for_email(text) to service_role;
