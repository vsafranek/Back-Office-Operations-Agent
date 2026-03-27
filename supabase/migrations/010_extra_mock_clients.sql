-- Další mock klienti pro Q1 aktuálního roku (zobrazí se ve vw_new_clients_q1 po 008/009).
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
) as v(
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
  select 1 from public.clients c where c.id = v.id
);
