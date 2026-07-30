-- stockkit/supabase/tests/rls.test.sql
-- RLS cross-vendor isolation — pgTAP, run with `supabase test db`.
-- Covers vendors, products, stock_movements, feedback — the tables that
-- exist as of 2026-07-22. Runs in ONE rolled-back transaction with inline
-- fixed-UUID fixtures.

begin;
select plan(37);

-- ── Fixtures ──────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vendor-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vendor-b@test.local'),
  -- Vendor C deliberately gets NO stockkit.vendors row: the column-level
  -- INSERT grant (0010) is only exercisable by a vendor whose row doesn't
  -- exist yet, which is exactly the first-signup / Google-OAuth case.
  ('00000000-0000-0000-0000-00000000000c',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vendor-c@test.local');

insert into stockkit.vendors (id, name)
values
  ('00000000-0000-0000-0000-00000000000a', 'Vendor A'),
  ('00000000-0000-0000-0000-00000000000b', 'Vendor B');

insert into stockkit.products (id, vendor_id, name, unit_cost_cents, on_hand, low_stock_threshold)
values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-00000000000a', 'A Product', 100, 10, 2),
  ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-00000000000b', 'B Product', 200, 5, 1);

insert into stockkit.stock_movements (id, vendor_id, product_id, delta, reason)
values
  ('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-0000000c0001', 10, 'initial'),
  ('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-0000000c0002', 5, 'initial');

-- ── RLS is actually enabled on every protected table ─────────────────────────
select ok((select relrowsecurity from pg_class where oid = 'stockkit.vendors'::regclass), 'RLS on vendors');
select ok((select relrowsecurity from pg_class where oid = 'stockkit.products'::regclass), 'RLS on products');
select ok((select relrowsecurity from pg_class where oid = 'stockkit.stock_movements'::regclass), 'RLS on stock_movements');
select ok((select relrowsecurity from pg_class where oid = 'stockkit.feedback'::regclass), 'RLS on feedback');

-- ── Act as Vendor A ────────────────────────────────────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text,
  true);

-- vendors: self select/insert/update, no cross-vendor read
select isnt_empty(
  $$ select 1 from stockkit.vendors where id = '00000000-0000-0000-0000-00000000000a' $$,
  'A reads its own vendors row');
select is_empty(
  $$ select 1 from stockkit.vendors where id = '00000000-0000-0000-0000-00000000000b' $$,
  'A cannot read B''s vendors row');
select lives_ok(
  $$ update stockkit.vendors set name = 'A Renamed' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'A can update its own vendors row');
select lives_ok(
  $$ update stockkit.vendors set tour_seen_at = now() where id = '00000000-0000-0000-0000-00000000000a' $$,
  'A can update its own tour_seen_at');
-- The plan-escalation guard (migration 0010). `plan` is outside the
-- column-level UPDATE grant, so the privilege check rejects the statement
-- before RLS is ever consulted — a vendor cannot self-grant Pro.
select throws_ok(
  $$ update stockkit.vendors set plan = 'pro' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'A cannot grant itself the Pro plan (no UPDATE grant on vendors.plan)');

-- products: vendor-all, WITH CHECK closes the re-point escalation
select isnt_empty(
  $$ select 1 from stockkit.products where id = '00000000-0000-0000-0000-0000000c0001' $$,
  'A reads its own product');
select is_empty(
  $$ select 1 from stockkit.products where id = '00000000-0000-0000-0000-0000000c0002' $$,
  'A cannot read B''s product');
select lives_ok(
  $$ update stockkit.products set name = 'A Renamed Product' where id = '00000000-0000-0000-0000-0000000c0001' $$,
  'A can update its own product');
-- Not throws_ok: authenticated has table-level UPDATE granted on products, so
-- the grant check passes. products_vendor_all's USING clause then filters
-- B's row out of the update's candidate set the same way it would filter a
-- SELECT — the statement just matches 0 rows, it does not raise an
-- exception. Matches the pattern paykit's rls.test.sql already uses for the
-- identical cross-vendor UPDATE case.
with upd as (
  update stockkit.products set name = 'hijack'
  where id = '00000000-0000-0000-0000-0000000c0002'
  returning 1)
select is((select count(*)::int from upd), 0, 'A cannot update B''s product');
select throws_ok(
  $$ insert into stockkit.products (vendor_id, name) values ('00000000-0000-0000-0000-00000000000b', 'sneaky') $$,
  '42501',
  null,
  'A cannot insert a product owned by B');

-- stock_movements: vendor select/insert only, no update/delete for anyone
select isnt_empty(
  $$ select 1 from stockkit.stock_movements where id = '00000000-0000-0000-0000-0000000d0001' $$,
  'A reads its own stock movement');
select is_empty(
  $$ select 1 from stockkit.stock_movements where id = '00000000-0000-0000-0000-0000000d0002' $$,
  'A cannot read B''s stock movement');
select lives_ok(
  $$ insert into stockkit.stock_movements (vendor_id, product_id, delta, reason)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000c0001', -2, 'waste') $$,
  'A can insert its own stock movement');
select throws_ok(
  $$ insert into stockkit.stock_movements (vendor_id, product_id, delta, reason)
     values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000c0002', 1, 'restock') $$,
  '42501',
  null,
  'A cannot insert a stock movement as B');
select throws_ok(
  $$ update stockkit.stock_movements set delta = 999 where id = '00000000-0000-0000-0000-0000000d0001' $$,
  '42501',
  null,
  'A cannot update its own stock movement (append-only, no UPDATE grant)');
select throws_ok(
  $$ delete from stockkit.stock_movements where id = '00000000-0000-0000-0000-0000000d0001' $$,
  '42501',
  null,
  'A cannot delete its own stock movement (append-only, no DELETE grant)');

-- feedback: self-insert-only
select lives_ok(
  $$ insert into stockkit.feedback (vendor_id, nps, message) values ('00000000-0000-0000-0000-00000000000a', 9, 'great') $$,
  'A can insert its own feedback');
select throws_ok(
  $$ insert into stockkit.feedback (vendor_id, nps) values ('00000000-0000-0000-0000-00000000000b', 5) $$,
  '42501',
  null,
  'A cannot insert feedback as B');

-- ── Act as Vendor B (spot-check the mirror direction) ────────────────────────
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text,
  true);
select isnt_empty(
  $$ select 1 from stockkit.vendors where id = '00000000-0000-0000-0000-00000000000b' $$,
  'B reads its own vendors row');
select is_empty(
  $$ select 1 from stockkit.products where vendor_id = '00000000-0000-0000-0000-00000000000a' $$,
  'B cannot read A''s products');

-- ── Act as Vendor C: first-signup insert (column-level INSERT grant) ────────
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000c', 'role', 'authenticated')::text,
  true);
select throws_ok(
  $$ insert into stockkit.vendors (id, name, plan)
     values ('00000000-0000-0000-0000-00000000000c', 'Vendor C', 'pro') $$,
  '42501',
  null,
  'C cannot smuggle plan = pro into its first vendors insert');
select lives_ok(
  $$ insert into stockkit.vendors (id, name)
     values ('00000000-0000-0000-0000-00000000000c', 'Vendor C') $$,
  'C can insert its own vendors row with only (id, name)');
select is(
  (select plan from stockkit.vendors where id = '00000000-0000-0000-0000-00000000000c'),
  'free',
  'C lands on the free plan by column default');

-- ── Free-plan active-product cap (products_vendor_insert / 0011) ─────────────
reset role;
select has_function(
  'stockkit', 'can_create_product', ARRAY['uuid']::name[],
  'stockkit.can_create_product(uuid) exists');

-- B already owns 1 active product; top it up to the Free cap of 20.
insert into stockkit.products (vendor_id, name)
select '00000000-0000-0000-0000-00000000000b', 'B Filler ' || g
from generate_series(1, 19) g;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text,
  true);
select throws_ok(
  $$ insert into stockkit.products (vendor_id, name)
     values ('00000000-0000-0000-0000-00000000000b', 'Over Cap') $$,
  '42501',
  null,
  'B on Free cannot insert a 21st active product');
select lives_ok(
  $$ update stockkit.products set is_active = false
     where id = '00000000-0000-0000-0000-0000000c0002' $$,
  'B can deactivate one of its own products');
select lives_ok(
  $$ insert into stockkit.products (vendor_id, name)
     values ('00000000-0000-0000-0000-00000000000b', 'Back Under Cap') $$,
  'B can insert again once it is back under 20 active products');

-- Pro lifts the cap entirely. Set by the service role — the only writer of
-- vendors.plan after 0010.
reset role;
update stockkit.vendors set plan = 'pro' where id = '00000000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text,
  true);
select lives_ok(
  $$ insert into stockkit.products (vendor_id, name)
     values ('00000000-0000-0000-0000-00000000000b', 'Pro Unlimited') $$,
  'B on Pro can insert past the Free cap');

-- ── Act as anon ───────────────────────────────────────────────────────────
reset role;
set local role anon;
-- Not is_empty: anon has no table-level GRANT at all on vendors/products/
-- stock_movements (migration 0001 only grants authenticated/service_role),
-- and the grant check runs before RLS is ever evaluated. So these raise
-- "permission denied for table ..." (42501), they don't just return an empty
-- result set — matches the pattern paykit's rls.test.sql uses for the same
-- no-grant-at-all case.
select throws_ok($$ select 1 from stockkit.vendors $$, '42501', null, 'anon cannot read vendors');
select throws_ok($$ select 1 from stockkit.products $$, '42501', null, 'anon cannot read products');
select throws_ok($$ select 1 from stockkit.stock_movements $$, '42501', null, 'anon cannot read stock_movements');
select throws_ok(
  $$ insert into stockkit.feedback (vendor_id, nps) values ('00000000-0000-0000-0000-00000000000a', 7) $$,
  '42501',
  null,
  'anon cannot insert feedback');
select throws_ok(
  $$ insert into stockkit.vendors (id, name) values ('00000000-0000-0000-0000-00000000000f', 'Fake') $$,
  '42501',
  null,
  'anon cannot insert a vendors row');

reset role;
select * from finish();
rollback;
