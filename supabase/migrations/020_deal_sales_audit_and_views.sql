-- BOA: rozšíření obchodů, prodané byty v agregaci, detail prodejů pro reporty/agenta.

-- === deals: audit prodeje (primární kupec zůstává client_id; více stran → budoucí deal_parties) ===
alter table public.deals
  add column if not exists contract_signed_at timestamptz,
  add column if not exists buyer_legal_name text,
  add column if not exists buyer_snapshot jsonb,
  add column if not exists internal_deal_ref text,
  add column if not exists listing_ref text,
  add column if not exists transfer_notes text;

comment on column public.deals.buyer_snapshot is
  'Volitelný snapshot kupce (katastr, IČO, spolukupci jako text v JSON) — primární kontakt je client_id.';
comment on column public.deals.contract_signed_at is 'Datum podpisu kupní smlouvy (odlišné od předání / sold_at, pokud CRM rozlišuje).';
comment on table public.deals is
  'Uzavřený obchod: jeden primární kupec přes client_id. Spolukupci / více stran řešit tabulkou deal_parties (ne v této migraci).';

create index if not exists idx_deals_contract_signed_at on public.deals (contract_signed_at desc)
  where contract_signed_at is not null;

-- Backfill: typický řád dat — podpis 1–14 dní před evidovaným prodejem
update public.deals d
set contract_signed_at = coalesce(d.contract_signed_at, d.sold_at - interval '7 days')
where d.sold_at is not null
  and d.contract_signed_at is null;

update public.deals d
set internal_deal_ref = coalesce(d.internal_deal_ref, 'DEAL-' || substring(d.id::text, 1, 8))
where d.internal_deal_ref is null or btrim(d.internal_deal_ref) = '';

-- === Agregace 6 měsíců: sold_count = prodané byty; zrušené obchody se nepočítají ===
create or replace view public.vw_leads_vs_sales_6m as
with months as (
  select
    date_trunc('month', now()) - (interval '1 month' * g.i) as month_start
  from generate_series(0, 5) as g(i)
)
select
  m.month_start::date as month,
  coalesce(l.leads_count, 0)::bigint as leads_count,
  coalesce(d.sold_count, 0)::bigint as sold_count
from months m
left join (
  select date_trunc('month', created_at) as mth, count(*)::bigint as leads_count
  from public.leads
  group by 1
) l on l.mth = m.month_start
left join (
  select date_trunc('month', d.sold_at) as mth, count(*)::bigint as sold_count
  from public.deals d
  left join public.properties p on p.id = d.property_id
  where d.sold_at is not null
    and coalesce(d.status, 'closed') <> 'cancelled'
    and (
      d.property_id is null
      or lower(trim(coalesce(p.property_kind, 'byt'))) = 'byt'
    )
  group by 1
) d on d.mth = m.month_start
order by m.month_start asc;

comment on view public.vw_leads_vs_sales_6m is
  'Leady (všechny) vs. prodané byty: obchody s nemovitostí druhu byt, bez property_id, nebo legacy property_kind null; status cancelled vynechán.';

-- === Detail obchodů pro export a agenta ===
create or replace view public.vw_deal_sales_detail as
select
  d.id as deal_id,
  d.sold_at,
  d.contract_signed_at,
  d.sold_price,
  d.status as deal_status,
  d.internal_deal_ref,
  d.listing_ref,
  d.buyer_legal_name,
  d.buyer_snapshot,
  d.deal_source,
  d.client_id,
  c.full_name,
  c.email,
  c.phone,
  d.property_id,
  p.title,
  coalesce(p.address->>'city', '') as city,
  coalesce(p.address->>'district', '') as district,
  p.property_kind,
  p.internal_ref
from public.deals d
left join public.clients c on c.id = d.client_id
left join public.properties p on p.id = d.property_id
where d.sold_at is not null
  and coalesce(d.status, 'closed') <> 'cancelled';

comment on view public.vw_deal_sales_detail is
  'Řádky prodaných obchodů: nemovitost, kupec (clients), čas a cena; pro textové filtrování v aplikaci.';

-- === Seed: další uzavřené byty v čase + jedna ukázka „ne-byt“ (nekompromituje sold_count v 6m view) ===
insert into public.deals (
  id, property_id, client_id, sold_price, sold_at, created_at,
  contract_signed_at, buyer_legal_name, internal_deal_ref, listing_ref, deal_source, status, lead_id
)
select * from (
  values
    (
      '03cc00a1-03cc-41cc-81cc-0300000000a1'::uuid,
      '01aa0003-01aa-41aa-81aa-010000000003'::uuid,
      '99999999-9999-9999-9999-999999999999'::uuid,
      6850000::numeric,
      date_trunc('month', now()) - interval '5 months' + interval '11 days',
      date_trunc('month', now()) - interval '5 months' + interval '11 days',
      date_trunc('month', now()) - interval '5 months' + interval '4 days',
      'Malá strana invest s.r.o.'::text,
      'DEAL-SEED-KAR'::text,
      'LIST-KAR-001'::text,
      'Web'::text,
      'closed'::text,
      null::uuid
    ),
    (
      '03cc00a2-03cc-41cc-81cc-0300000000a2'::uuid,
      '01aa0001-01aa-41aa-81aa-010000000001'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6'::uuid,
      9350000::numeric,
      date_trunc('month', now()) - interval '5 months' + interval '22 days',
      date_trunc('month', now()) - interval '5 months' + interval '22 days',
      date_trunc('month', now()) - interval '5 months' + interval '18 days',
      null::text,
      'DEAL-SEED-KOR'::text,
      null::text,
      'Sreality'::text,
      'closed'::text,
      null::uuid
    )
) as v(
  id, property_id, client_id, sold_price, sold_at, created_at,
  contract_signed_at, buyer_legal_name, internal_deal_ref, listing_ref, deal_source, status, lead_id
)
where not exists (select 1 from public.deals d where d.id = v.id);

insert into public.deals (
  id, property_id, client_id, sold_price, sold_at, created_at,
  contract_signed_at, internal_deal_ref, deal_source, status
)
select * from (
  values
    (
      '03cc00b1-03cc-41cc-81cc-0300000000b1'::uuid,
      '01aa0005-01aa-41aa-81aa-010000000005'::uuid,
      '77777777-7777-7777-7777-777777777777'::uuid,
      12600000::numeric,
      date_trunc('month', now()) - interval '2 months' + interval '5 days',
      date_trunc('month', now()) - interval '2 months' + interval '5 days',
      date_trunc('month', now()) - interval '2 months' + interval '1 days',
      'DEAL-SEED-DUM'::text,
      'Osobní kontakt'::text,
      'closed'::text
    )
) as v(id, property_id, client_id, sold_price, sold_at, created_at, contract_signed_at, internal_deal_ref, deal_source, status)
where not exists (select 1 from public.deals d where d.id = v.id);
