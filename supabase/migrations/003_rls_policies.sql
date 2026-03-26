alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.properties enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.calendar_slots enable row level security;
alter table public.reports enable row level security;
alter table public.agent_runs enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.data_quality_issues enable row level security;
alter table public.market_listings enable row level security;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'reporter') then
    create role reporter noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'automation_worker') then
    create role automation_worker noinherit;
  end if;
end
$$;

create policy "app_user_read_clients"
on public.clients
for select
to app_user
using (true);

create policy "reporter_read_views_clients"
on public.clients
for select
to reporter
using (true);

create policy "automation_worker_manage_runs"
on public.workflow_runs
for all
to automation_worker
using (true)
with check (true);

create policy "automation_worker_manage_agent_runs"
on public.agent_runs
for all
to automation_worker
using (true)
with check (true);
