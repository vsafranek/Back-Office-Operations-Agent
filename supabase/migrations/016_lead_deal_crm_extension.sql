-- BOA-017: pipeline leadů, detaily obchodů (provize, zdroj), FK, view, backfill.

-- === leads ===
alter table public.leads
  add column if not exists updated_at timestamptz,
  add column if not exists last_contact_at timestamptz,
  add column if not exists expected_value_czk numeric(14, 2),
  add column if not exists lost_reason text,
  add column if not exists notes text;

update public.leads
set updated_at = created_at
where updated_at is null;

alter table public.leads
  alter column updated_at set default now(),
  alter column updated_at set not null;

comment on column public.leads.status is
  'Doporučené hodnoty: new, contacted, qualified, viewing, offer, won, lost (text bez CHECK).';
comment on column public.leads.expected_value_czk is 'Orientační hodnota obchodu z leadu (CZK).';
comment on column public.leads.lost_reason is 'Důvod ztráty / zamítnutí pro analýzu funnelu.';

-- Osiřelé property_id před FK
update public.leads l
set property_id = null
where l.property_id is not null
  and not exists (select 1 from public.properties p where p.id = l.property_id);

-- FK property_id → properties
alter table public.leads
  drop constraint if exists leads_property_id_fkey;

alter table public.leads
  add constraint leads_property_id_fkey
  foreign key (property_id)
  references public.properties (id)
  on delete set null;

create index if not exists idx_leads_status_created_at on public.leads (status, created_at desc);
create index if not exists idx_leads_property_id on public.leads (property_id) where property_id is not null;

-- === deals ===
alter table public.deals
  add column if not exists lead_id uuid,
  add column if not exists commission_czk numeric(14, 2),
  add column if not exists commission_rate_pct numeric(5, 2),
  add column if not exists deal_source text,
  add column if not exists status text not null default 'closed';

comment on column public.deals.status is 'closed | cancelled | pending';
comment on column public.deals.commission_rate_pct is 'Sazba v % z sold_price (např. 3.00).';
comment on column public.deals.deal_source is 'Zdroj obchodu (kanál / interní / doporučení).';

alter table public.deals
  drop constraint if exists deals_lead_id_fkey;

alter table public.deals
  add constraint deals_lead_id_fkey
  foreign key (lead_id)
  references public.leads (id)
  on delete set null;

create index if not exists idx_deals_lead_id on public.deals (lead_id) where lead_id is not null;

-- === View: souhrn pipeline podle statusu ===
create or replace view public.vw_lead_pipeline_summary as
select
  l.status,
  count(*)::bigint as leads_count,
  coalesce(sum(l.expected_value_czk), 0)::numeric(14, 2) as expected_value_czk_sum,
  min(l.created_at) as oldest_lead_at,
  max(l.created_at) as newest_lead_at
from public.leads l
group by l.status
order by l.status;

-- === Backfill leads ===
update public.leads l
set
  expected_value_czk = p.listed_price,
  updated_at = l.created_at
from public.properties p
where l.property_id = p.id
  and l.expected_value_czk is null
  and p.listed_price is not null;

-- === Backfill deals: lead_id (jednoznačný pár client_id + property_id), provize, zdroj ===
update public.deals d
set lead_id = s.lead_id
from (
  select distinct on (l.client_id, l.property_id)
    l.client_id,
    l.property_id,
    l.id as lead_id
  from public.leads l
  where l.client_id is not null
    and l.property_id is not null
  order by l.client_id, l.property_id, l.created_at desc
) s
where d.client_id = s.client_id
  and d.property_id = s.property_id
  and d.lead_id is null;

update public.deals d
set
  commission_rate_pct = 3.00,
  commission_czk = round(d.sold_price * 0.03, 2)
where d.sold_price is not null
  and d.commission_czk is null;

update public.deals d
set deal_source = coalesce(l.source_channel, 'unknown')
from public.leads l
where d.lead_id = l.id
  and (d.deal_source is null or d.deal_source = '');

update public.deals
set deal_source = 'unknown'
where deal_source is null;
