-- Test seed data for Back Office Operations Agent
-- Safe to run repeatedly (idempotent with fixed UUIDs + where not exists).

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

insert into public.properties (id, title, city, district, listed_price, reconstruction_notes, structural_changes, created_at)
select * from (
  values
    ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'Byt 2+kk Tusarova', 'Praha', 'Holesovice', 7990000, 'Nova koupelna 2022', 'Dispozicni upravy ne', now() - interval '120 days'),
    ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid, 'Byt 3+1 Ortenovo namesti', 'Praha', 'Holesovice', 11490000, null, null, now() - interval '90 days'),
    ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid, 'Byt 1+kk Delnicka', 'Praha', 'Holesovice', 5490000, '', null, now() - interval '60 days')
) as v(id, title, city, district, listed_price, reconstruction_notes, structural_changes, created_at)
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
