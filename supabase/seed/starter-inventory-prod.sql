-- Optional hosted demo seed, not run automatically.
-- Replace __VENDOR_ID__ with your existing vendor UUID before manual use.
-- Requires migration 0018 or later: each new nonzero balance receives its
-- opening ledger row from the insert trigger. Existing products are untouched,
-- including their owner, metadata, quantity and historical ledger.
-- Fixed-ID conflicts are skipped, so rerunning cannot reset or transfer stock.
-- Historical demo movements from older seeds are intentionally not rewritten.

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
on conflict (id) do nothing;
