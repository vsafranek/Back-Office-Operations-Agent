-- Omezit Q1 klienty na aktuální kalendářní rok (Europe/Prague).
create or replace view public.vw_new_clients_q1 as
select
  c.id,
  c.full_name,
  c.email,
  c.source_channel,
  c.created_at
from public.clients c
where extract(quarter from (c.created_at at time zone 'Europe/Prague')) = 1
  and extract(year from (c.created_at at time zone 'Europe/Prague'))
    = extract(year from (now() at time zone 'Europe/Prague'))
order by c.created_at desc;

-- Stabilní řádek pro lokální/CI test (fixní UUID, idempotentní).
insert into public.clients (id, full_name, email, phone, source_channel, created_at)
select * from (
  values
    (
      '44444444-4444-4444-4444-444444444444'::uuid,
      'Test Q1 Fixture',
      'q1.fixture@example.com',
      '+420700000001',
      'TestPortal',
      make_timestamptz(
        extract(year from (now() at time zone 'Europe/Prague'))::int,
        2,
        15,
        12,
        0,
        0,
        'Europe/Prague'
      )
    )
) as v(id, full_name, email, phone, source_channel, created_at)
where not exists (
  select 1 from public.clients c where c.id = v.id
);
