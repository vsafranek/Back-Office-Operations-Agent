-- Propojení odchozích e-mailů (audit) s leady — které leady byly kontaktovány.

create table if not exists public.outbound_email_event_leads (
  outbound_email_event_id uuid not null references public.outbound_email_events (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  primary key (outbound_email_event_id, lead_id)
);

create index if not exists outbound_email_event_leads_lead_idx
  on public.outbound_email_event_leads (lead_id);

comment on table public.outbound_email_event_leads is 'M:N outbound e-mail (audit) ↔ lead — kontaktované leady.';

alter table public.outbound_email_event_leads enable row level security;

create policy "users_read_own_outbound_email_event_leads"
on public.outbound_email_event_leads
for select
to authenticated
using (
  exists (
    select 1 from public.outbound_email_events e
    where e.id = outbound_email_event_id and e.user_id = auth.uid()
  )
);
