begin;
select plan(13);
insert into auth.users(id,instance_id,aud,role,email) values
('10000000-0000-4000-8000-000000000020','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-scope-owner@test.local'),
('10000000-0000-4000-8000-000000000030','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-scope-foreign@test.local');
insert into stockkit.vendors(id,name,plan) values('10000000-0000-4000-8000-000000000020','Owner','free'),('10000000-0000-4000-8000-000000000030','Foreign','pro');
create function pg_temp.profile_sync_checks() returns setof text language plpgsql as $checks$
declare links jsonb;
begin
 if to_regclass('merqo.vendor_profile') is null then return query select skip(2,'Shared Merqo schema is required for profile assertions'); return; end if;
 execute $fixture$insert into merqo.vendor_profile(vendor_id,stall_name,social_links) values('10000000-0000-4000-8000-000000000020','Old','{"website":"https://example.com"}')$fixture$;
 perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000020","role":"authenticated"}',true);
 return next lives_ok('select stockkit.sync_vendor_profile(''New'')','owner may synchronize name');
 execute 'select social_links from merqo.vendor_profile where vendor_id=''10000000-0000-4000-8000-000000000020''' into links;
 return next is(links,'{"website":"https://example.com"}'::jsonb,'name synchronization preserves social links');
end;
$checks$;
select ok(not has_function_privilege('anon','stockkit.sync_vendor_profile(text)','EXECUTE'),'anonymous signup profile write revoked');
select ok(not has_function_privilege('anon','stockkit.can_create_product(uuid)','EXECUTE'),'anonymous entitlement probing revoked');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000020","role":"authenticated"}',true);
select is(stockkit.can_create_product('10000000-0000-4000-8000-000000000020'),true,'own vendor retains product cap check');
select is(stockkit.can_create_product('10000000-0000-4000-8000-000000000030'),false,'foreign vendor entitlement is not exposed');
reset role;
select * from pg_temp.profile_sync_checks();
select ok(not has_function_privilege('authenticated','stockkit._can_create_product_unchecked(uuid)','EXECUTE'),'private cap helper is not an alternate lookup');
insert into stockkit.products(id,vendor_id,name,is_active) values('20000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000020','Operator fixture',false);
select lives_ok($$update stockkit.products set is_active=true where id='20000000-0000-4000-8000-000000000020'$$,'trusted operator reactivation still uses internal cap check');
select ok(not has_function_privilege('anon','stockkit.is_admin(uuid)','EXECUTE'),'anonymous administrator probing revoked');
insert into stockkit.admins(user_id) values('10000000-0000-4000-8000-000000000030');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000020","role":"authenticated"}',true);
select is(stockkit.is_admin('10000000-0000-4000-8000-000000000030'),false,'foreign administrator membership is private');
select is(stockkit.can_create_product(null),false,'null vendor fails closed');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(stockkit.is_admin('10000000-0000-4000-8000-000000000030'),true,'service administration retains membership lookup');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select is(stockkit.is_admin('10000000-0000-4000-8000-000000000030'),false,'existing administrator remains private without identity claims');
reset role;
select * from finish();
rollback;
