-- Sjednocená migrace: rekonstrukce + checklist, adresa (jsonb), DQI seed, portfolio backfill, mock 01dd, RPC.

-- === 1. Sloupce rekonstrukce ===
alter table public.properties
  add column if not exists reconstruction_status text,
  add column if not exists building_works_checklist jsonb not null default '[]'::jsonb,
  add column if not exists reconstruction_budget_estimate_czk numeric(14, 2),
  add column if not exists reconstruction_last_reviewed_at timestamptz;

comment on column public.properties.reconstruction_status is
  'Stav rekonstrukce v CRM: not_assessed | not_required | planned | in_progress | completed (doporučené hodnoty, text bez enforce).';
comment on column public.properties.building_works_checklist is
  'JSON pole řetězců — plánované / potřebné stavební úpravy (položky k doplnění).';
comment on column public.properties.reconstruction_budget_estimate_czk is
  'Orientační rozpočet rekonstrukce v CZK (volitelné).';
comment on column public.properties.reconstruction_last_reviewed_at is
  'Poslední kontrola / aktualizace údajů o rekonstrukci.';

-- === 2. Adresa v JSONB (nahrazuje city + district) ===
alter table public.properties
  add column if not exists address jsonb;

update public.properties
set
  address = jsonb_strip_nulls(
    jsonb_build_object(
      'city', city,
      'district', district,
      'country', 'CZ'
    )
  )
where address is null;

alter table public.properties
  alter column address set not null,
  alter column address set default '{}'::jsonb;

comment on column public.properties.address is
  'Adresa nemovitosti: doporučené klíče city, district, street, postal_code, country (ISO 3166-1 alpha-2).';

alter table public.properties drop column if exists city;
alter table public.properties drop column if exists district;

-- === 3. RPC (výstup: city odvozené z address + celý address) ===
drop function if exists public.fn_missing_reconstruction_data();

create function public.fn_missing_reconstruction_data()
returns table (
  property_id uuid,
  title text,
  city text,
  address jsonb,
  missing_reconstruction boolean,
  missing_structural_changes boolean,
  reconstruction_status text,
  building_works_checklist jsonb,
  reconstruction_budget_estimate_czk numeric,
  reconstruction_last_reviewed_at timestamptz
)
language sql
stable
as $$
  select
    p.id as property_id,
    p.title,
    coalesce(p.address->>'city', '') as city,
    p.address,
    (p.reconstruction_notes is null or btrim(p.reconstruction_notes) = '') as missing_reconstruction,
    (p.structural_changes is null or btrim(p.structural_changes) = '') as missing_structural_changes,
    p.reconstruction_status,
    p.building_works_checklist,
    p.reconstruction_budget_estimate_czk,
    p.reconstruction_last_reviewed_at
  from public.properties p
  where (p.reconstruction_notes is null or btrim(p.reconstruction_notes) = '')
     or (p.structural_changes is null or btrim(p.structural_changes) = '');
$$;

-- === 4. TEST nemovitosti (DQI) ===
insert into public.properties (
  id,
  title,
  address,
  listed_price,
  reconstruction_notes,
  structural_changes,
  created_at,
  property_kind,
  listing_status,
  usable_area_m2,
  internal_ref
)
select * from (
  values
    (
      '01cc0001-01cc-41cc-81cc-010000000001'::uuid,
      'TEST Byt bez rekonstrukce ani úprav',
      '{"city":"Plzeň","district":"Slovany","country":"CZ"}'::jsonb,
      4500000::numeric,
      null,
      null,
      now() - interval '30 days',
      'byt',
      'active',
      52::numeric,
      'TEST-DQI-001'
    ),
    (
      '01cc0002-01cc-41cc-81cc-010000000002'::uuid,
      'TEST Dům jen s poznámkou k rekonstrukci',
      '{"city":"Olomouc","country":"CZ"}'::jsonb,
      9200000::numeric,
      'Potřeba nová elektroinstalace',
      null,
      now() - interval '28 days',
      'dum',
      'active',
      110::numeric,
      'TEST-DQI-002'
    ),
    (
      '01cc0003-01cc-41cc-81cc-010000000003'::uuid,
      'TEST Byt jen se stavebními úpravami v textu',
      '{"city":"Brno","district":"Žabovřesky","country":"CZ"}'::jsonb,
      6100000::numeric,
      null,
      'Předělání příček obývák / kuchyň',
      now() - interval '26 days',
      'byt',
      'active',
      64::numeric,
      'TEST-DQI-003'
    ),
    (
      '01cc0004-01cc-41cc-81cc-010000000004'::uuid,
      'TEST Komplet vyplněné — neměl by být v seznamu chybějících',
      '{"city":"Praha","district":"Dejvice","country":"CZ"}'::jsonb,
      15500000::numeric,
      'Rekonstrukce 2019',
      'Beze změny nosných prvků',
      now() - interval '24 days',
      'byt',
      'active',
      78::numeric,
      'TEST-DQI-COMPLETE'
    ),
    (
      '01cc0005-01cc-41cc-81cc-010000000005'::uuid,
      'TEST Pozemek bez údajů',
      '{"city":"České Budějovice","country":"CZ"}'::jsonb,
      3100000::numeric,
      null,
      null,
      now() - interval '22 days',
      'pozemek',
      'active',
      null,
      'TEST-DQI-005'
    )
) as v(
  id,
  title,
  address,
  listed_price,
  reconstruction_notes,
  structural_changes,
  created_at,
  property_kind,
  listing_status,
  usable_area_m2,
  internal_ref
)
where not exists (select 1 from public.properties p where p.id = v.id);

insert into public.data_quality_issues (
  entity_type,
  entity_id,
  issue_code,
  severity,
  status,
  notes
)
select
  'property',
  p.id,
  'missing_reconstruction_fields',
  'medium',
  'open',
  'Chybí reconstruction_notes a/nebo structural_changes (seed pro BOA-005 / agent).'
from public.properties p
where p.internal_ref in ('TEST-DQI-001', 'TEST-DQI-002', 'TEST-DQI-003')
  and not exists (
    select 1
    from public.data_quality_issues d
    where d.entity_id = p.id
      and d.issue_code = 'missing_reconstruction_fields'
      and d.status = 'open'
  );

-- === 5. Backfill rekonstrukce u portfolia (011) + TEST řádků ===
update public.properties p
set
  reconstruction_status = v.reconstruction_status,
  building_works_checklist = v.building_works_checklist::jsonb,
  reconstruction_budget_estimate_czk = v.reconstruction_budget_estimate_czk,
  reconstruction_last_reviewed_at = v.reconstruction_last_reviewed_at
from (
  values
    ('PF-VIN-201'::text, 'planned'::text, '["Výměna oken", "Rekonstrukce jádra", "Podlahy"]'::text, 850000::numeric, now() - interval '14 days'::interval),
    ('PF-UN-202'::text, 'in_progress'::text, '["Zateplení střechy", "Terasa"]'::text, 1200000::numeric, now() - interval '7 days'::interval),
    ('PF-KAR-203'::text, 'not_assessed'::text, '[]'::text, null::numeric, null::timestamptz),
    ('PF-BNO-204'::text, 'planned'::text, '["Přípojky IS", "Oplotení"]'::text, 450000::numeric, now() - interval '21 days'::interval),
    ('PF-LIB-205'::text, 'not_required'::text, '[]'::text, null::numeric, now() - interval '60 days'::interval),
    ('PF-HOS-206'::text, 'not_assessed'::text, '["Elektroinstalace", "Omítky"]'::text, null::numeric, null::timestamptz),
    ('PF-MS-207'::text, 'completed'::text, '[]'::text, null::numeric, now() - interval '400 days'::interval),
    ('PF-OST-208'::text, 'planned'::text, '["SDK podhledy", "Vzduchotechnika"]'::text, 380000::numeric, now() - interval '3 days'::interval),
    ('PF-STO-209'::text, 'not_required'::text, '[]'::text, null::numeric, now() - interval '30 days'::interval),
    ('PF-CER-210'::text, 'planned'::text, '["Koupelna", "Terasa", "ČOV"]'::text, 650000::numeric, now() - interval '10 days'::interval),
    ('TEST-DQI-001'::text, 'not_assessed'::text, '[]'::text, null::numeric, null::timestamptz),
    ('TEST-DQI-002'::text, 'planned'::text, '["Nová elektro rozvaděč"]'::text, 180000::numeric, now() - interval '2 days'::interval),
    ('TEST-DQI-003'::text, 'not_assessed'::text, '["Bourání příček", "Nové rozvody vody"]'::text, null::numeric, null::timestamptz),
    ('TEST-DQI-005'::text, 'not_assessed'::text, '[]'::text, null::numeric, null::timestamptz),
    ('TEST-DQI-COMPLETE'::text, 'completed'::text, '[]'::text, null::numeric, now() - interval '100 days'::interval)
) as v(internal_ref, reconstruction_status, building_works_checklist, reconstruction_budget_estimate_czk, reconstruction_last_reviewed_at)
where p.internal_ref = v.internal_ref;

update public.properties
set reconstruction_status = coalesce(reconstruction_status, 'not_assessed')
where reconstruction_status is null;

-- === 6. Mock nemovitosti (01dd) ===
insert into public.properties (
  id,
  title,
  address,
  listed_price,
  reconstruction_notes,
  structural_changes,
  created_at,
  property_kind,
  listing_status,
  usable_area_m2,
  internal_ref,
  reconstruction_status,
  building_works_checklist,
  reconstruction_budget_estimate_czk,
  reconstruction_last_reviewed_at
)
select * from (
  values
    (
      '01dd0001-01dd-41dd-81dd-010000000001'::uuid,
      'Byt 3+1 panel Háje',
      '{"city":"Praha","district":"Háje","country":"CZ"}'::jsonb,
      7200000::numeric,
      'Panel 80. léta, původní jádro.',
      'Nenosné příčky lze měnit dle PD.',
      now() - interval '18 days',
      'byt',
      'active',
      76::numeric,
      'PF-HAJ-301',
      'planned'::text,
      '["Celková výměna jádra", "Zednické úpravy po elektřině", "Vinylové podlahy"]'::jsonb,
      920000::numeric,
      now() - interval '5 days'
    ),
    (
      '01dd0002-01dd-41dd-81dd-010000000002'::uuid,
      'Rodinný dům se zahradou Lysolaje',
      '{"city":"Praha","district":"Lysolaje","country":"CZ"}'::jsonb,
      22400000::numeric,
      'Částečná rekonstrukce 2015, kuchyň nová.',
      'Půdní vestavba vyžaduje statiku.',
      now() - interval '12 days',
      'dum',
      'active',
      155::numeric,
      'PF-LYS-302',
      'in_progress'::text,
      '["Půdní vestavba", "Fasáda", "Tepelné čerpadlo"]'::jsonb,
      2800000::numeric,
      now() - interval '1 day'
    ),
    (
      '01dd0003-01dd-41dd-81dd-010000000003'::uuid,
      'Investiční byt Kladno',
      '{"city":"Kladno","district":"Centrum","country":"CZ"}'::jsonb,
      4100000::numeric,
      null,
      null,
      now() - interval '8 days',
      'byt',
      'active',
      48::numeric,
      'PF-KLA-303',
      'not_assessed'::text,
      '[]'::jsonb,
      null::numeric,
      null::timestamptz
    ),
    (
      '01dd0004-01dd-41dd-81dd-010000000004'::uuid,
      'Rekreační chata Orlík',
      '{"city":"Staré Sedlo","country":"CZ"}'::jsonb,
      5600000::numeric,
      'Sezónní využití, studna na pozemku.',
      null,
      now() - interval '6 days',
      'dum',
      'active',
      42::numeric,
      'PF-ORL-304',
      'planned'::text,
      '["Čistička odpadních vod", "Zateplení obvodu", "Nová střecha"]'::jsonb,
      1100000::numeric,
      now() - interval '4 days'
    ),
    (
      '01dd0005-01dd-41dd-81dd-010000000005'::uuid,
      'Luxusní loft Smíchov',
      '{"city":"Praha","district":"Smíchov","country":"CZ"}'::jsonb,
      18900000::numeric,
      'Kompletní rekonstrukce 2022, loftový standard.',
      'Žádné plánované zásahy do nosných konstrukcí.',
      now() - interval '4 days',
      'byt',
      'reserved',
      95::numeric,
      'PF-SMI-305',
      'completed'::text,
      '[]'::jsonb,
      null::numeric,
      now() - interval '90 days'
    ),
    (
      '01dd0006-01dd-41dd-81dd-010000000006'::uuid,
      'Garsonka studentská Zlín',
      '{"city":"Zlín","district":"Jižní Svahy","country":"CZ"}'::jsonb,
      2950000::numeric,
      null,
      'Jen kosmetika.',
      now() - interval '3 days',
      'byt',
      'active',
      28::numeric,
      'PF-ZLN-306',
      'not_required'::text,
      '[]'::jsonb,
      null::numeric,
      now() - interval '20 days'
    )
) as v(
  id,
  title,
  address,
  listed_price,
  reconstruction_notes,
  structural_changes,
  created_at,
  property_kind,
  listing_status,
  usable_area_m2,
  internal_ref,
  reconstruction_status,
  building_works_checklist,
  reconstruction_budget_estimate_czk,
  reconstruction_last_reviewed_at
)
where not exists (select 1 from public.properties p where p.id = v.id);
