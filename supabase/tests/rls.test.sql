-- stockkit/supabase/tests/rls.test.sql
-- RLS cross-vendor isolation — pgTAP, run with `supabase test db`.
-- Covers vendors, products, stock_movements, feedback — the tables that
-- exist as of 2026-07-22. Runs in ONE rolled-back transaction with inline
-- fixed-UUID fixtures.

begin;
select plan(54);

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
-- the grant check passes. products_vendor_update's USING clause then filters
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

-- ── The multi-row INSERT bypass (products_enforce_active_cap / 0011) ─────────
-- RLS WITH CHECK is evaluated per row against the statement's own snapshot,
-- so rows inserted earlier in the SAME statement are invisible to a later
-- row's check. Every assertion below runs against Vendor C, who is on Free
-- with zero products — i.e. products_vendor_insert's per-row check passes for
-- all of them, and only the AFTER ... FOR EACH STATEMENT trigger can catch
-- the batch. The expected message is matched exactly so a pass can't come
-- from the RLS layer instead: both raise 42501, only the trigger says this.
reset role;
select has_function(
  'stockkit', 'active_product_cap', ARRAY['uuid']::name[],
  'stockkit.active_product_cap(uuid) exists');
select has_trigger(
  'stockkit', 'products', 'products_enforce_active_cap',
  'products carries the statement-level cap trigger');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000c', 'role', 'authenticated')::text,
  true);
select throws_ok(
  $$ insert into stockkit.products (vendor_id, name)
     select '00000000-0000-0000-0000-00000000000c', 'C Batch ' || g
     from generate_series(1, 25) g $$,
  '42501',
  'active product limit exceeded: 25 active, 20 allowed on the free plan',
  'C on Free cannot insert 25 products in one multi-row statement');
select is(
  (select count(*)::int from stockkit.products
   where vendor_id = '00000000-0000-0000-0000-00000000000c'),
  0,
  'the whole over-cap statement rolls back — not just its over-limit rows');

-- The same statement one row under the cap: allowed, then a batch that
-- straddles the boundary from under to over is refused whole.
reset role;
insert into stockkit.products (vendor_id, name)
select '00000000-0000-0000-0000-00000000000c', 'C Filler ' || g
from generate_series(1, 19) g;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000c', 'role', 'authenticated')::text,
  true);
select throws_ok(
  $$ insert into stockkit.products (vendor_id, name)
     select '00000000-0000-0000-0000-00000000000c', 'C Straddle ' || g
     from generate_series(1, 5) g $$,
  '42501',
  'active product limit exceeded: 24 active, 20 allowed on the free plan',
  'C at 19 cannot cross the cap with a 5-row statement');
select is(
  (select count(*)::int from stockkit.products
   where vendor_id = '00000000-0000-0000-0000-00000000000c' and is_active),
  19,
  'C is still at 19 active products after the rejected batch');
select lives_ok(
  $$ insert into stockkit.products (vendor_id, name)
     values ('00000000-0000-0000-0000-00000000000c', 'C Twentieth') $$,
  'C can still take its 20th product one row at a time');

-- ── The reactivation bypass (products_enforce_reactivation_limit_* / 0012) ───
-- 0011 only closed the INSERT half of the cap; deactivate→insert→reactivate
-- still got a vendor past the cap before 0012. C is at exactly 20 active
-- here (from the block above) — deactivate one, fill its slot with a new
-- insert, then try to bring the deactivated one back: 21 active, refused.
reset role;
select has_trigger(
  'stockkit', 'products', 'products_enforce_reactivation_limit_row',
  'products carries the row-level reactivation-cap trigger');
select has_trigger(
  'stockkit', 'products', 'products_enforce_reactivation_limit_statement',
  'products carries the statement-level reactivation-cap trigger');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000c', 'role', 'authenticated')::text,
  true);
select lives_ok(
  $$ update stockkit.products set is_active = false
     where vendor_id = '00000000-0000-0000-0000-00000000000c' and name = 'C Filler 1' $$,
  'C can deactivate one of its 20 active products');
select lives_ok(
  $$ insert into stockkit.products (vendor_id, name)
     values ('00000000-0000-0000-0000-00000000000c', 'C Slot Filler') $$,
  'C can insert a replacement, back to 20 active');
select throws_ok(
  $$ update stockkit.products set is_active = true
     where vendor_id = '00000000-0000-0000-0000-00000000000c' and name = 'C Filler 1' $$,
  '42501',
  null,
  'C cannot reactivate the deactivated product once back at 20 active');
select is(
  (select is_active from stockkit.products
   where vendor_id = '00000000-0000-0000-0000-00000000000c' and name = 'C Filler 1'),
  false,
  'the refused reactivation left the product inactive');
select is(
  (select count(*)::int from stockkit.products
   where vendor_id = '00000000-0000-0000-0000-00000000000c' and is_active),
  20,
  'C is still at exactly 20 active products after the refused reactivation');

-- ── The multi-row reactivation bypass, same-statement case ───────────────────
-- Unlike RLS's WITH CHECK (evaluated per row against one fixed
-- statement-wide snapshot — the mechanism 0011 documented as blind to a
-- batched INSERT), a row-level TRIGGER runs live SQL, and Postgres advances
-- the command counter between successive rows of the same statement so each
-- row's trigger sees the effects already applied by earlier rows in that
-- same statement. So the row-level trigger above turns out to already catch
-- a same-statement batch on its own — confirmed empirically below: it's the
-- row-level trigger's message that's expected, not the statement-level
-- trigger's, since the row-level one raises first (on the row that would
-- push the count over cap) and aborts the whole statement before the
-- AFTER ... FOR EACH STATEMENT trigger ever runs. That statement-level
-- trigger's real value is the *concurrent-transaction* race the row-level
-- trigger cannot see (two separate sessions each reactivating one product at
-- once) — its per-vendor advisory lock serializes those, the same reason
-- 0011's insert-side statement trigger takes one. Vendor D is fresh: 18
-- active + 3 inactive, then one multi-row UPDATE tries to reactivate all 3
-- at once (→ 21 active, over the 20 cap).
reset role;
insert into auth.users (id, instance_id, aud, role, email)
values (
  '00000000-0000-0000-0000-00000000000d',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'vendor-d@test.local');
insert into stockkit.vendors (id, name) values ('00000000-0000-0000-0000-00000000000d', 'Vendor D');
insert into stockkit.products (vendor_id, name, is_active)
select '00000000-0000-0000-0000-00000000000d', 'D Active ' || g, true
from generate_series(1, 18) g;
insert into stockkit.products (vendor_id, name, is_active)
select '00000000-0000-0000-0000-00000000000d', 'D Inactive ' || g, false
from generate_series(1, 3) g;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000d', 'role', 'authenticated')::text,
  true);
select throws_ok(
  $$ update stockkit.products set is_active = true
     where vendor_id = '00000000-0000-0000-0000-00000000000d' and not is_active $$,
  '42501',
  'active product limit exceeded: cannot reactivate, at the free plan cap',
  'D cannot reactivate all 3 inactive products in one multi-row statement (caught by the row-level trigger, mid-batch)');
select is(
  (select count(*)::int from stockkit.products
   where vendor_id = '00000000-0000-0000-0000-00000000000d' and is_active),
  18,
  'the whole over-cap reactivation statement rolls back — D stays at 18 active');

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
-- `stockkit` is a PostgREST-exposed schema and functions default to EXECUTE
-- for PUBLIC, so without 0011's REVOKE this would be a live
-- POST /rest/v1/rpc/can_create_product oracle: pass any vendor UUID, learn
-- whether that vendor is on Pro or under their cap.
select throws_ok(
  $$ select stockkit.can_create_product('00000000-0000-0000-0000-00000000000a') $$,
  '42501',
  null,
  'anon cannot execute can_create_product');

reset role;
select * from finish();
rollback;
