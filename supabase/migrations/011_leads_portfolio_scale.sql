-- Rozšíření portfolia nemovitostí, indexy pro exporty a hromadné testovací leady/deals v čase (6 měsíců).

alter table public.properties
  add column if not exists property_kind text,
  add column if not exists listing_status text,
  add column if not exists usable_area_m2 numeric(12, 2),
  add column if not exists internal_ref text;

comment on column public.properties.property_kind is 'Interní typ: byt, dum, pozemek, …';
comment on column public.properties.listing_status is 'Stav nabídky: active, reserved, sold_off_market, …';
comment on column public.properties.usable_area_m2 is 'Podlahová / užitná plocha (volitelné).';
comment on column public.properties.internal_ref is 'Interní kód nemovitosti.';

update public.properties
set
  property_kind = coalesce(property_kind, 'byt'),
  listing_status = coalesce(listing_status, 'active'),
  usable_area_m2 = coalesce(usable_area_m2, 55),
  internal_ref = coalesce(internal_ref, 'PROP-LEG-' || id::text)
where property_kind is null or listing_status is null;

create index if not exists idx_leads_created_at on public.leads (created_at desc);
create index if not exists idx_deals_sold_at on public.deals (sold_at desc) where sold_at is not null;
create index if not exists idx_properties_created_at on public.properties (created_at desc);

-- === Nové nemovitosti (portfolio) — idempotentní UUID ===
insert into public.properties (
  id,
  title,
  city,
  district,
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
    ('01aa0001-01aa-41aa-81aa-010000000001'::uuid, 'Byt 2+1 Korunní', 'Praha', 'Vinohrady', 9200000::numeric, null, null, now() - interval '200 days', 'byt', 'active', 68::numeric, 'PF-VIN-201'),
    ('01aa0002-01aa-41aa-81aa-010000000002'::uuid, 'Rodinný dům Únětice', 'Únětice', null, 18500000::numeric, 'Zahrada 400 m²', null, now() - interval '175 days', 'dum', 'active', 142::numeric, 'PF-UN-202'),
    ('01aa0003-01aa-41aa-81aa-010000000003'::uuid, 'Byt 1+kk Karlínské nám.', 'Praha', 'Karlín', 6790000::numeric, null, null, now() - interval '150 days', 'byt', 'reserved', 36::numeric, 'PF-KAR-203'),
    ('01aa0004-01aa-41aa-81aa-010000000004'::uuid, 'Pozemek stavební Brno-Líšeň', 'Brno', 'Líšeň', 4200000::numeric, null, null, now() - interval '130 days', 'pozemek', 'active', null, 'PF-BNO-204'),
    ('01aa0005-01aa-41aa-81aa-010000000005'::uuid, 'Byt 3+kk waterfront', 'Praha', 'Libeň', 12800000::numeric, 'Lodžie', null, now() - interval '110 days', 'byt', 'active', 89::numeric, 'PF-LIB-205'),
    ('01aa0006-01aa-41aa-81aa-010000000006'::uuid, 'Byt 2+kk tramvaj Depo', 'Praha', 'Hostivař', 7100000::numeric, null, null, now() - interval '95 days', 'byt', 'active', 54::numeric, 'PF-HOS-206'),
    ('01aa0007-01aa-41aa-81aa-010000000007'::uuid, 'Historický byt Malá Strana', 'Praha', 'Malá Strana', 24900000::numeric, 'Částečná rekonstrukce', 'nosné zdi beze změny', now() - interval '85 days', 'byt', 'reserved', 112::numeric, 'PF-MS-207'),
    ('01aa0008-01aa-41aa-81aa-010000000008'::uuid, 'Kancelářská jednotka Ostrava', 'Ostrava', 'Centrum', 5200000::numeric, null, null, now() - interval '70 days', 'komerc', 'active', 78::numeric, 'PF-OST-208'),
    ('01aa0009-01aa-41aa-81aa-010000000009'::uuid, 'Byt 4+kk novostavba Stodůlky', 'Praha', 'Stodůlky', 13200000::numeric, 'Standard vývojáře', null, now() - interval '55 days', 'byt', 'active', 98::numeric, 'PF-STO-209'),
    ('01aa0010-01aa-41aa-81aa-01000000000a'::uuid, 'Chata Černošice', 'Černošice', null, 8900000::numeric, 'Vybaveno', null, now() - interval '40 days', 'dum', 'active', 65::numeric, 'PF-CER-210')
) as v(id, title, city, district, listed_price, reconstruction_notes, structural_changes, created_at, property_kind, listing_status, usable_area_m2, internal_ref)
where not exists (select 1 from public.properties p where p.id = v.id);

-- === Leady rozložené do posledních měsíců (pro vw_leads_vs_sales_6m) ===
insert into public.leads (id, client_id, property_id, status, source_channel, created_at)
select * from (
  values
    ('02bb0001-02bb-41bb-81bb-020000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '01aa0001-01aa-41aa-81aa-010000000001'::uuid, 'qualified'::text, 'Sreality'::text, date_trunc('month', now()) + interval '3 days'),
    ('02bb0002-02bb-41bb-81bb-020000000002'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '01aa0002-01aa-41aa-81aa-010000000002'::uuid, 'new'::text, 'Bezrealitky'::text, date_trunc('month', now()) + interval '8 days'),
    ('02bb0003-02bb-41bb-81bb-020000000003'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'new'::text, 'Doporuceni'::text, date_trunc('month', now()) + interval '12 days'),
    ('02bb0004-02bb-41bb-81bb-020000000004'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '01aa0003-01aa-41aa-81aa-010000000003'::uuid, 'qualified'::text, 'Sreality'::text, date_trunc('month', now()) + interval '18 days'),
    ('02bb0010-02bb-41bb-81bb-020000000010'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, '01aa0005-01aa-41aa-81aa-010000000005'::uuid, 'new'::text, 'iDNES Reality'::text, date_trunc('month', now()) - interval '1 month' + interval '2 days'),
    ('02bb0011-02bb-41bb-81bb-020000000011'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, '01aa0006-01aa-41aa-81aa-010000000006'::uuid, 'qualified'::text, 'Facebook skupiny'::text, date_trunc('month', now()) - interval '1 month' + interval '9 days'),
    ('02bb0012-02bb-41bb-81bb-020000000012'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid, 'new'::text, 'Bezrealitky'::text, date_trunc('month', now()) - interval '1 month' + interval '14 days'),
    ('02bb0013-02bb-41bb-81bb-020000000013'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, '01aa0007-01aa-41aa-81aa-010000000007'::uuid, 'new'::text, 'Sreality'::text, date_trunc('month', now()) - interval '1 month' + interval '21 days'),
    ('02bb0014-02bb-41bb-81bb-020000000014'::uuid, '77777777-7777-7777-7777-777777777777'::uuid, '01aa0004-01aa-41aa-81aa-010000000004'::uuid, 'qualified'::text, 'Web'::text, date_trunc('month', now()) - interval '1 month' + interval '26 days'),
    ('02bb0020-02bb-41bb-81bb-020000000020'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '01aa0008-01aa-41aa-81aa-010000000008'::uuid, 'new'::text, 'Sreality'::text, date_trunc('month', now()) - interval '2 months' + interval '4 days'),
    ('02bb0021-02bb-41bb-81bb-020000000021'::uuid, '88888888-8888-8888-8888-888888888888'::uuid, '01aa0009-01aa-41aa-81aa-010000000009'::uuid, 'qualified'::text, 'Osobní kontakt'::text, date_trunc('month', now()) - interval '2 months' + interval '11 days'),
    ('02bb0022-02bb-41bb-81bb-020000000022'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid, 'new'::text, 'Bezrealitky'::text, date_trunc('month', now()) - interval '2 months' + interval '19 days'),
    ('02bb0023-02bb-41bb-81bb-020000000023'::uuid, '99999999-9999-9999-9999-999999999999'::uuid, '01aa0010-01aa-41aa-81aa-01000000000a'::uuid, 'new'::text, 'Sreality'::text, date_trunc('month', now()) - interval '2 months' + interval '24 days'),
    ('02bb0030-02bb-41bb-81bb-020000000030'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, '01aa0001-01aa-41aa-81aa-010000000001'::uuid, 'qualified'::text, 'Doporuceni'::text, date_trunc('month', now()) - interval '3 months' + interval '6 days'),
    ('02bb0031-02bb-41bb-81bb-020000000031'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6'::uuid, '01aa0002-01aa-41aa-81aa-010000000002'::uuid, 'new'::text, 'Web'::text, date_trunc('month', now()) - interval '3 months' + interval '15 days'),
    ('02bb0032-02bb-41bb-81bb-020000000032'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, '01aa0005-01aa-41aa-81aa-010000000005'::uuid, 'new'::text, 'Facebook skupiny'::text, date_trunc('month', now()) - interval '3 months' + interval '22 days'),
    ('02bb0040-02bb-41bb-81bb-020000000040'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '01aa0003-01aa-41aa-81aa-010000000003'::uuid, 'qualified'::text, 'Sreality'::text, date_trunc('month', now()) - interval '4 months' + interval '5 days'),
    ('02bb0041-02bb-41bb-81bb-020000000041'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7'::uuid, '01aa0006-01aa-41aa-81aa-010000000006'::uuid, 'new'::text, 'Bezrealitky'::text, date_trunc('month', now()) - interval '4 months' + interval '17 days'),
    ('02bb0050-02bb-41bb-81bb-020000000050'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'new'::text, 'Sreality'::text, date_trunc('month', now()) - interval '5 months' + interval '7 days'),
    ('02bb0051-02bb-41bb-81bb-020000000051'::uuid, 'cccccccc-cccc-cccc-cccc-ccccccccccc8'::uuid, '01aa0004-01aa-41aa-81aa-010000000004'::uuid, 'qualified'::text, 'iDNES Reality'::text, date_trunc('month', now()) - interval '5 months' + interval '20 days')
) as v(id, client_id, property_id, status, source_channel, created_at)
where not exists (select 1 from public.leads l where l.id = v.id);

-- === Další uzavřené obchody (sold_at v posledních měsících) ===
insert into public.deals (id, property_id, client_id, sold_price, sold_at, created_at)
select * from (
  values
    ('03cc0001-03cc-41cc-81cc-030000000001'::uuid, '01aa0009-01aa-41aa-81aa-010000000009'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 12950000::numeric, date_trunc('month', now()) + interval '10 days', date_trunc('month', now()) + interval '10 days'),
    ('03cc0002-03cc-41cc-81cc-030000000002'::uuid, '01aa0006-01aa-41aa-81aa-010000000006'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 7050000::numeric, date_trunc('month', now()) - interval '1 month' + interval '16 days', date_trunc('month', now()) - interval '1 month' + interval '16 days'),
    ('03cc0003-03cc-41cc-81cc-030000000003'::uuid, '01aa0002-01aa-41aa-81aa-010000000002'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 17800000::numeric, date_trunc('month', now()) - interval '2 months' + interval '8 days', date_trunc('month', now()) - interval '2 months' + interval '8 days'),
    ('03cc0004-03cc-41cc-81cc-030000000004'::uuid, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 11200000::numeric, date_trunc('month', now()) - interval '3 months' + interval '12 days', date_trunc('month', now()) - interval '3 months' + interval '12 days'),
    ('03cc0005-03cc-41cc-81cc-030000000005'::uuid, '01aa0005-01aa-41aa-81aa-010000000005'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, 12490000::numeric, date_trunc('month', now()) - interval '4 months' + interval '3 days', date_trunc('month', now()) - interval '4 months' + interval '3 days')
) as v(id, property_id, client_id, sold_price, sold_at, created_at)
where not exists (select 1 from public.deals d where d.id = v.id);
