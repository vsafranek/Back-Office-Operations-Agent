-- Test seed data for Back Office Operations Agent
-- Safe to run repeatedly (idempotent with fixed UUIDs + where not exists).

-- Po migraci 009 lze hodnoty doplnit přes stejné UPDATE jako v 009, nebo ručně.
insert into public.clients (id, full_name, email, phone, source_channel, created_at)
select * from (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'Jan Novak', 'jan.novak@example.com', '+420777111222', 'Sreality', now() - interval '70 days'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Petra Svobodova', 'petra.svobodova@example.com', '+420777333444', 'Bezrealitky', now() - interval '45 days'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'Martin Kral', 'martin.kral@example.com', '+420777555666', 'Doporuceni', now() - interval '20 days')
) as v(id, full_name, email, phone, source_channel, created_at)
where not exists (
  select 1 from public.clients c where c.id = v.id
);

-- Stejné řádky jako migrace 010 (po 009 existují sloupce preference).
insert into public.clients (
  id,
  full_name,
  email,
  phone,
  source_channel,
  created_at,
  preferred_city,
  preferred_district,
  property_type_interest,
  budget_min_czk,
  budget_max_czk,
  property_notes
)
select *
from (
  values
    (
      '55555555-5555-5555-5555-555555555555'::uuid,
      'Eva Horníková',
      'eva.hornikova@example.com',
      '+420601111001',
      'iDNES Reality',
      make_timestamptz(
        extract(year from (now() at time zone 'Europe/Prague'))::int,
        1,
        9,
        11,
        15,
        0,
        'Europe/Prague'
      ),
      'Praha',
      'Dejvice',
      'byt 3+kk',
      12300000::numeric,
      15500000::numeric,
      'Blízko metra, výhled do zeleně.'
    ),
    (
      '66666666-6666-6666-6666-666666666666'::uuid,
      'Tomáš Berger',
      'tomas.berger@example.com',
      '+420602222002',
      'Facebook skupiny',
      make_timestamptz(
        extract(year from (now() at time zone 'Europe/Prague'))::int,
        1,
        22,
        14,
        40,
        0,
        'Europe/Prague'
      ),
      'Praha',
      'Žižkov',
      'byt 1+1',
      4800000::numeric,
      6200000::numeric,
      'První bydlení, preferuje částečně zařízeno.'
    ),
    (
      '77777777-7777-7777-7777-777777777777'::uuid,
      'Lucie Dvořáková',
      'lucie.dvorakova@example.com',
      '+420603333003',
      'Sreality',
      make_timestamptz(
        extract(year from (now() at time zone 'Europe/Prague'))::int,
        2,
        3,
        9,
        0,
        0,
        'Europe/Prague'
      ),
      'Brno',
      'Střed',
      'byt 2+1',
      7200000::numeric,
      8900000::numeric,
      'Kancelář do 20 minut pěšky.'
    ),
    (
      '88888888-8888-8888-8888-888888888888'::uuid,
      'Jakub Polák',
      'jakub.polak@example.com',
      '+420604444004',
      'Bezrealitky',
      make_timestamptz(
        extract(year from (now() at time zone 'Europe/Prague'))::int,
        2,
        18,
        16,
        10,
        0,
        'Europe/Prague'
      ),
      'Praha',
      'Vršovice',
      'byt 2+kk',
      8500000::numeric,
      10200000::numeric,
      'Balkón nebo terasa nutnost.'
    ),
    (
      '99999999-9999-9999-9999-999999999999'::uuid,
      'Ivana Králová',
      'ivana.kralova@example.com',
      '+420605555005',
      'Doporučení',
      make_timestamptz(
        extract(year from (now() at time zone 'Europe/Prague'))::int,
        2,
        27,
        10,
        5,
        0,
        'Europe/Prague'
      ),
      'Praha',
      'Holešovice',
      'loft / atypický byt',
      9500000::numeric,
      12000000::numeric,
      'Kamarádka už u vás kupovala — chce něco podobného.'
    ),
    (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6'::uuid,
      'Marek Urban',
      'marek.urban@example.com',
      '+420606666006',
      'Realitní web (vlastní lead)',
      make_timestamptz(
        extract(year from (now() at time zone 'Europe/Prague'))::int,
        3,
        4,
        13,
        25,
        0,
        'Europe/Prague'
      ),
      'Praha',
      'Smíchov',
      'byt 4+kk',
      14500000::numeric,
      18900000::numeric,
      'Rodina se dvěma dětmi, potřeba školka v okolí.'
    ),
    (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7'::uuid,
      'Simona Novotná',
      'simona.novotna@example.com',
      '+420607777007',
      'Sreality',
      make_timestamptz(
        extract(year from (now() at time zone 'Europe/Prague'))::int,
        3,
        11,
        8,
        50,
        0,
        'Europe/Prague'
      ),
      'Praha',
      'Karlín',
      'byt 2+kk',
      9800000::numeric,
      11500000::numeric,
      'Investice, pronájem flexibilní.'
    ),
    (
      'cccccccc-cccc-cccc-cccc-ccccccccccc8'::uuid,
      'Ondřej Čech',
      'ondrej.cech@example.com',
      '+420608888008',
      'Účast na veletrhu',
      make_timestamptz(
        extract(year from (now() at time zone 'Europe/Prague'))::int,
        3,
        20,
        15,
        0,
        0,
        'Europe/Prague'
      ),
      'Praha',
      'Libeň',
      'rodinný dům',
      18000000::numeric,
      24000000::numeric,
      'Zahrada min. 200 m², do 30 min do centra MHD.'
    )
) as ve(
  id,
  full_name,
  email,
  phone,
  source_channel,
  created_at,
  preferred_city,
  preferred_district,
  property_type_interest,
  budget_min_czk,
  budget_max_czk,
  property_notes
)
where not exists (
  select 1 from public.clients c where c.id = ve.id
);

insert into public.properties (id, title, address, listed_price, reconstruction_notes, structural_changes, created_at)
select * from (
  values
    ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'Byt 2+kk Tusarova', '{"city":"Praha","district":"Holesovice","country":"CZ"}'::jsonb, 7990000, 'Nova koupelna 2022', 'Dispozicni upravy ne', now() - interval '120 days'),
    ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid, 'Byt 3+1 Ortenovo namesti', '{"city":"Praha","district":"Holesovice","country":"CZ"}'::jsonb, 11490000, null, null, now() - interval '90 days'),
    ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid, 'Byt 1+kk Delnicka', '{"city":"Praha","district":"Holesovice","country":"CZ"}'::jsonb, 5490000, '', null, now() - interval '60 days')
) as v(id, title, address, listed_price, reconstruction_notes, structural_changes, created_at)
where not exists (
  select 1 from public.properties p where p.id = v.id
);

insert into public.leads (id, client_id, property_id, status, source_channel, created_at)
select * from (
  values
    ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'qualified', 'Sreality', now() - interval '55 days'),
    ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid, 'new', 'Bezrealitky', now() - interval '35 days'),
    ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid, 'new', 'Doporuceni', now() - interval '15 days')
) as v(id, client_id, property_id, status, source_channel, created_at)
where not exists (
  select 1 from public.leads l where l.id = v.id
);

insert into public.deals (id, property_id, client_id, sold_price, sold_at, created_at)
select * from (
  values
    ('ccccccc1-cccc-cccc-cccc-ccccccccccc1'::uuid, 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 7850000, now() - interval '40 days', now() - interval '40 days')
) as v(id, property_id, client_id, sold_price, sold_at, created_at)
where not exists (
  select 1 from public.deals d where d.id = v.id
);

insert into public.activities (entity_type, entity_id, activity_type, payload, created_at)
select 'lead', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid, 'phone_call', '{"result":"scheduled_viewing"}'::jsonb, now() - interval '50 days'
where not exists (
  select 1
  from public.activities a
  where a.entity_type = 'lead'
    and a.entity_id = 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid
    and a.activity_type = 'phone_call'
);

insert into public.market_listings (external_id, title, location, source, url, observed_at)
select * from (
  values
    ('seed-listing-1', 'Byt 2+kk Praha Holesovice - novinka', 'Praha Holesovice', 'seed_feed', 'https://example.com/listing/seed-1', now() - interval '1 day'),
    ('seed-listing-2', 'Byt 3+kk Praha Holesovice - novinka', 'Praha Holesovice', 'seed_feed', 'https://example.com/listing/seed-2', now() - interval '1 day')
) as v(external_id, title, location, source, url, observed_at)
where not exists (
  select 1 from public.market_listings m where m.external_id = v.external_id
);
