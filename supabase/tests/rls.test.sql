-- stockkit/supabase/tests/rls.test.sql
-- RLS cross-vendor isolation — pgTAP, run with `supabase test db`.
-- Covers vendors, products, stock_movements, feedback — the tables that
-- exist as of 2026-07-22. Runs in ONE rolled-back transaction with inline
-- fixed-UUID fixtures.

begin;
select plan(40);

-- ── Fixtures ──────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vendor-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vendor-b@test.local');

insert into stockkit.vendors (id, name)
values
  ('00000000-0000-0000-0000-00000000000a', 'Vendor A'),
  ('00000000-0000-0000-0000-00000000000b', 'Vendor B');

insert into stockkit.products (id, vendor_id, name, unit_cost_cents, on_hand, low_stock_threshold)
values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-00000000000a', 'A Product', 100, 10, 2),
  ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-00000000000b', 'B Product', 200, 5, 1),
  ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-00000000000a', 'A Raw Material', 50, 100, 10);

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

-- ── product_components: RLS + no-nesting ────────────────────────────────────
select ok(
  (select relrowsecurity from pg_class where oid = 'stockkit.product_components'::regclass),
  'RLS on product_components');

select lives_ok(
  $$ insert into stockkit.product_components (parent_product_id, component_product_id, quantity_per_unit)
     values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0003', 2) $$,
  'A can link two of its own products');

select throws_ok(
  $$ insert into stockkit.product_components (parent_product_id, component_product_id, quantity_per_unit)
     values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0002', 1) $$,
  '42501',
  null,
  'A cannot link B''s product as a component (WITH CHECK rejects cross-vendor component)');

select is_empty(
  $$ select 1 from stockkit.product_components
     where parent_product_id = '00000000-0000-0000-0000-0000000c0001'
       and component_product_id = '00000000-0000-0000-0000-0000000c0002' $$,
  'the cross-vendor insert above did not land any row');

select throws_ok(
  $$ insert into stockkit.product_components (parent_product_id, component_product_id, quantity_per_unit)
     values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0001', 1) $$,
  '23514',
  null,
  'a product cannot be its own component (CHECK violation)');

select throws_ok(
  $$ insert into stockkit.product_components (parent_product_id, component_product_id, quantity_per_unit)
     values ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000c0001', 1) $$,
  'P0001',
  null,
  'a component cannot itself become a parent elsewhere (no nested linking)');

select isnt_empty(
  $$ select 1 from stockkit.product_components
     where parent_product_id = '00000000-0000-0000-0000-0000000c0001' $$,
  'A can read its own product_components row');

-- ── record_linked_movement: fan-out + atomicity ─────────────────────────────
select lives_ok(
  $$ select stockkit.record_linked_movement(
       '00000000-0000-0000-0000-0000000c0001'::uuid, 5, 'restock', 'produced 5', 150, null
     ) $$,
  'A can call record_linked_movement on its own linked product');

select results_eq(
  $$ select on_hand from stockkit.products where id = '00000000-0000-0000-0000-0000000c0001' $$,
  $$ values (15::numeric) $$,
  'parent on_hand grew by the produced amount (10 + 5)');

select results_eq(
  $$ select on_hand from stockkit.products where id = '00000000-0000-0000-0000-0000000c0003' $$,
  $$ values (90::numeric) $$,
  'component on_hand shrank by delta * quantity_per_unit (100 - 5*2)');

select results_eq(
  $$ select count(distinct linked_movement_id) from stockkit.stock_movements
     where product_id in ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0003')
       and linked_movement_id is not null $$,
  $$ values (1::bigint) $$,
  'the parent and component movements share one linked_movement_id');

select throws_ok(
  $$ select stockkit.record_linked_movement(
       '00000000-0000-0000-0000-0000000c0001'::uuid, 1000, 'restock', null, null, null
     ) $$,
  'P0001',
  null,
  'a fan-out that would take the component below zero rolls back the whole call');

select results_eq(
  $$ select on_hand from stockkit.products where id = '00000000-0000-0000-0000-0000000c0001' $$,
  $$ values (15::numeric) $$,
  'the failed call above did not partially apply — parent on_hand unchanged');

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
