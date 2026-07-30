-- Starter inventory demo seed for PRODUCTION (hosted Supabase).
--
-- Run in the Supabase SQL Editor. Replace __VENDOR_ID__ (every occurrence)
-- with the auth user id of the vendor account this demo data should belong
-- to — your own account's User UID (Authentication → Users → your user →
-- copy UID). vendors.id == auth.users.id. Assumes that vendor row already
-- exists (i.e. you've already signed up and completed onboarding) — unlike
-- qkit's seed scripts, this doesn't upsert the vendors row itself, since a
-- vendor demoing this to their own account will always already have one.
--
-- 6 products spanning all three stock statuses (3 ok, 2 low, 1 out) so the
-- dashboard's value/alert stats and "Needs attention" list all have
-- something real to show. Idempotent: safe to re-run — products upsert by
-- fixed id; stock_movements insert-if-missing by fixed id, so a re-run
-- neither duplicates ledger rows nor re-applies them against on_hand
-- (on_hand is set directly by the products upsert below, not derived from
-- the movements).

with v as (select '__VENDOR_ID__'::uuid as vendor_id)
insert into stockkit.products (id, vendor_id, name, unit, unit_cost_cents, on_hand, low_stock_threshold, is_active)
select p.id, v.vendor_id, p.name, p.unit, p.unit_cost_cents, p.on_hand, p.low_stock_threshold, true
from v, (values
  -- id, name, unit, unit_cost_cents, on_hand, low_stock_threshold
  ('5eed0001-0000-4000-8000-000000000001'::uuid, 'Whole Bean Coffee 1kg', 'bag',   1850, 42, 10),
  ('5eed0002-0000-4000-8000-000000000002'::uuid, 'Oat Milk 1L',           'carton', 420,  6,  8),
  ('5eed0003-0000-4000-8000-000000000003'::uuid, 'Paper Cups 8oz (100pk)','pack',   600,  0,  5),
  ('5eed0004-0000-4000-8000-000000000004'::uuid, 'Sugar Sachets (500pk)', 'box',    320, 24,  5),
  ('5eed0005-0000-4000-8000-000000000005'::uuid, 'Chocolate Syrup 1L',    'bottle', 980,  3,  4),
  ('5eed0006-0000-4000-8000-000000000006'::uuid, 'Ice Cubes 5kg',         'bag',    250, 15,  6)
) as p(id, name, unit, unit_cost_cents, on_hand, low_stock_threshold)
on conflict (id) do update
  set vendor_id            = excluded.vendor_id,
      name                 = excluded.name,
      unit                 = excluded.unit,
      unit_cost_cents      = excluded.unit_cost_cents,
      on_hand              = excluded.on_hand,
      low_stock_threshold  = excluded.low_stock_threshold,
      is_active            = true;

with v as (select '__VENDOR_ID__'::uuid as vendor_id)
insert into stockkit.stock_movements (id, vendor_id, product_id, delta, reason, note, unit_cost_cents, created_at)
select m.id, v.vendor_id, m.product_id, m.delta, m.reason, m.note, m.unit_cost_cents, now() - m.age
from v, (values
  -- id, product_id, delta, reason, note, unit_cost_cents, age
  ('5eed1001-0000-4000-8000-000000000001'::uuid, '5eed0001-0000-4000-8000-000000000001'::uuid,  50, 'initial',    null,                              1850, interval '21 days'),
  ('5eed1002-0000-4000-8000-000000000002'::uuid, '5eed0001-0000-4000-8000-000000000001'::uuid, -20, 'waste',      'Bag torn in storage',             1850, interval '3 days'),
  ('5eed1003-0000-4000-8000-000000000003'::uuid, '5eed0001-0000-4000-8000-000000000001'::uuid,  12, 'restock',    'New harvest batch',               1850, interval '2 hours'),
  ('5eed1004-0000-4000-8000-000000000004'::uuid, '5eed0002-0000-4000-8000-000000000002'::uuid,  30, 'initial',    null,                               420, interval '18 days'),
  ('5eed1005-0000-4000-8000-000000000005'::uuid, '5eed0002-0000-4000-8000-000000000002'::uuid, -24, 'waste',      'Near expiry, discarded',           420, interval '5 days'),
  ('5eed1006-0000-4000-8000-000000000006'::uuid, '5eed0003-0000-4000-8000-000000000003'::uuid,  15, 'initial',    null,                               600, interval '25 days'),
  ('5eed1007-0000-4000-8000-000000000007'::uuid, '5eed0003-0000-4000-8000-000000000003'::uuid, -15, 'adjustment', 'Recount: box was already opened', 600, interval '1 days'),
  ('5eed1008-0000-4000-8000-000000000008'::uuid, '5eed0004-0000-4000-8000-000000000004'::uuid,  24, 'initial',    null,                               320, interval '14 days'),
  ('5eed1009-0000-4000-8000-000000000009'::uuid, '5eed0005-0000-4000-8000-000000000005'::uuid,   8, 'initial',    null,                               980, interval '12 days'),
  ('5eed100a-0000-4000-8000-00000000000a'::uuid, '5eed0005-0000-4000-8000-000000000005'::uuid,  -5, 'waste',      'Bottle cracked',                  980, interval '4 days'),
  ('5eed100b-0000-4000-8000-00000000000b'::uuid, '5eed0006-0000-4000-8000-000000000006'::uuid,  15, 'initial',    null,                               250, interval '7 days')
) as m(id, product_id, delta, reason, note, unit_cost_cents, age)
on conflict (id) do nothing;
