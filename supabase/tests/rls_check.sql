-- =====================================================================
-- 權限（RLS）與資料完整性檢查
--
-- 用法：在 Supabase Dashboard 切換到 keepmoney 專案（網址含 ypsvifalrikqhxydbyxd），
--       整段貼到 SQL Editor 執行，看最後的結果表，每一列都應該是 ✅。
-- 整段在同一個交易裡，最後 rollback：測試帳號與資料都不會留下。
-- 修改資料表或 policy 之後請重跑一次。
-- =====================================================================
begin;

-- 防呆：在別的專案執行時直接停止，不會動到那個專案
do $$
begin
  if to_regclass('public.ledger_members') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
     ) then
    raise exception '這個專案沒有 KeepMoney 的資料表：請在 Dashboard 左上角切換到 keepmoney 專案再執行';
  end if;
end;
$$;

create temp table results (n int, test text, outcome text);
grant all on results to authenticated, anon;

-- 兩個測試使用者：Alice、Bob（會觸發註冊流程，自動建立帳本）
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-alice@keepmoney.test', '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-bob@keepmoney.test', '{"display_name":"Bob"}'::jsonb, now(), now());

do $$
declare
  cnt int;
begin
  select count(*) into cnt
  from public.ledger_members m
  join public.accounts a on a.ledger_id = m.ledger_id
  where m.user_id = '00000000-0000-4000-8000-0000000000a1' and m.role = 'owner';
  insert into results values (1, '註冊後自動建立帳本、擁有者身分與現金帳戶', case when cnt = 1 then '✅' else '❌ 帳戶數 ' || cnt end);

  select count(*) into cnt
  from public.ledger_members m
  join public.categories c on c.ledger_id = m.ledger_id
  where m.user_id = '00000000-0000-4000-8000-0000000000a1';
  insert into results values (2, '註冊後自動建立 16 個預設分類', case when cnt = 16 then '✅' else '❌ ' || cnt end);
end;
$$;

-- ---------------------------------------------------------------------
-- Alice：正常記帳流程
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  l uuid := (select id from public.ledgers);
  cash uuid := (select id from public.accounts where name = '現金');
  bank uuid;
  card uuid;
  food uuid := (select id from public.categories where name = '飲食');
  breakfast uuid;
  bal_cash numeric;
  bal_bank numeric;
  bal_card numeric;
begin
  insert into public.accounts (ledger_id, name, type, initial_balance) values (l, '銀行', 'bank', 50000) returning id into bank;
  insert into public.accounts (ledger_id, name, type) values (l, '信用卡', 'credit_card') returning id into card;
  insert into public.categories (ledger_id, kind, parent_id, name) values (l, 'expense', food, '早餐') returning id into breakfast;

  insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id)
  values (l, 'expense', 120, '2026-10-28', cash, breakfast);
  insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id)
  values (l, 'income', 40000, '2026-10-05', bank, (select id from public.categories where name = '薪資'));
  insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, to_account_id)
  values (l, 'transfer', 3000, '2026-10-06', bank, cash);
  insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id)
  values (l, 'expense', 800, '2026-10-10', card, (select id from public.categories where name = '購物'));

  insert into public.tags (ledger_id, name) values (l, '旅行');
  insert into public.transaction_tags (ledger_id, transaction_id, tag_id)
  select l, t.id, g.id from public.transactions t, public.tags g where t.amount = 800;

  insert into public.budgets (ledger_id, amount) values (l, 20000);
  insert into public.budgets (ledger_id, category_id, amount) values (l, food, 6000);

  insert into public.recurring_transactions (ledger_id, type, amount, account_id, category_id, note, start_on, next_occurs_on)
  values (l, 'expense', 12000, bank, (select id from public.categories where name = '居家'), '房租', '2026-11-01', '2026-11-01');

  select balance into bal_cash from public.account_balances where account_id = cash;
  select balance into bal_bank from public.account_balances where account_id = bank;
  select balance into bal_card from public.account_balances where account_id = card;
  insert into results values (3, '帳戶餘額：現金 2880／銀行 87000／信用卡 -800',
    case when (bal_cash, bal_bank, bal_card) = (2880, 87000, -800) then '✅'
         else format('❌ %s／%s／%s', bal_cash, bal_bank, bal_card) end);
  insert into results values (4, 'Alice 新增帳戶、子分類、交易、標籤、預算、定期收支', '✅');
exception when others then
  insert into results values (4, 'Alice 新增帳戶、子分類、交易、標籤、預算、定期收支', '❌ ' || sqlerrm);
end;
$$;
reset role;

-- 以管理者身分取得兩人的資料 id，供 Bob 的測試使用
create temp table ids as
select
  (select ledger_id from public.ledger_members where user_id = '00000000-0000-4000-8000-0000000000a1') as alice_ledger,
  (select a.id from public.accounts a join public.ledger_members m on m.ledger_id = a.ledger_id
    where m.user_id = '00000000-0000-4000-8000-0000000000a1' and a.name = '現金') as alice_cash,
  (select ledger_id from public.ledger_members where user_id = '00000000-0000-4000-8000-0000000000b1') as bob_ledger,
  (select a.id from public.accounts a join public.ledger_members m on m.ledger_id = a.ledger_id
    where m.user_id = '00000000-0000-4000-8000-0000000000b1' and a.name = '現金') as bob_cash,
  (select c.id from public.categories c join public.ledger_members m on m.ledger_id = c.ledger_id
    where m.user_id = '00000000-0000-4000-8000-0000000000b1' and c.name = '飲食') as bob_food,
  (select c.id from public.categories c join public.ledger_members m on m.ledger_id = c.ledger_id
    where m.user_id = '00000000-0000-4000-8000-0000000000b1' and c.name = '薪資') as bob_salary;
grant select on ids to authenticated;

-- ---------------------------------------------------------------------
-- Bob：不能看到或動到 Alice 的資料，且各項約束要擋下錯誤資料
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  r record;
  cnt int;
  new_ledger uuid;
begin
  select * into r from ids;

  select count(*) into cnt from public.ledgers;
  insert into results values (10, 'Bob 只看得到自己的 1 本帳本', case when cnt = 1 then '✅' else '❌ ' || cnt end);
  select count(*) into cnt from public.transactions;
  insert into results values (11, 'Bob 看不到 Alice 的交易', case when cnt = 0 then '✅' else '❌ ' || cnt end);
  select count(*) into cnt from public.profiles;
  insert into results values (12, 'Bob 只看得到自己的個人資料', case when cnt = 1 then '✅' else '❌ ' || cnt end);
  select count(*) into cnt from public.ledger_members;
  insert into results values (13, 'Bob 只看得到自己帳本的成員', case when cnt = 1 then '✅' else '❌ ' || cnt end);
  select count(*) into cnt from public.account_balances;
  insert into results values (14, 'Bob 的餘額 view 只有自己的 1 個帳戶', case when cnt = 1 then '✅' else '❌ ' || cnt end);

  begin
    insert into public.accounts (ledger_id, name) values (r.alice_ledger, '偷塞的帳戶');
    insert into results values (15, '不能寫入 Alice 的帳本', '❌ 寫入成功');
  exception when others then
    insert into results values (15, '不能寫入 Alice 的帳本', '✅ ' || sqlerrm);
  end;

  begin
    insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id)
    values (r.bob_ledger, 'expense', 10, '2026-10-28', r.alice_cash, r.bob_food);
    insert into results values (16, '交易不能引用別本帳本的帳戶', '❌ 寫入成功');
  exception when others then
    insert into results values (16, '交易不能引用別本帳本的帳戶', '✅ ' || sqlerrm);
  end;

  begin
    insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id)
    values (r.bob_ledger, 'expense', 10, '2026-10-28', r.bob_cash, r.bob_salary);
    insert into results values (17, '支出不能用收入分類', '❌ 寫入成功');
  exception when others then
    insert into results values (17, '支出不能用收入分類', '✅ ' || sqlerrm);
  end;

  begin
    insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, to_account_id)
    values (r.bob_ledger, 'transfer', 10, '2026-10-28', r.bob_cash, r.bob_cash);
    insert into results values (18, '不能轉帳給同一個帳戶', '❌ 寫入成功');
  exception when others then
    insert into results values (18, '不能轉帳給同一個帳戶', '✅ ' || sqlerrm);
  end;

  begin
    insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id)
    values (r.bob_ledger, 'expense', -10, '2026-10-28', r.bob_cash, r.bob_food);
    insert into results values (19, '金額不能是負數', '❌ 寫入成功');
  exception when others then
    insert into results values (19, '金額不能是負數', '✅ ' || sqlerrm);
  end;

  begin
    insert into public.budgets (ledger_id, category_id, amount) values (r.bob_ledger, r.bob_salary, 100);
    insert into results values (20, '預算不能設在收入分類', '❌ 寫入成功');
  exception when others then
    insert into results values (20, '預算不能設在收入分類', '✅ ' || sqlerrm);
  end;

  begin
    insert into public.budgets (ledger_id, amount) values (r.bob_ledger, 100);
    insert into public.budgets (ledger_id, amount) values (r.bob_ledger, 200);
    insert into results values (21, '每月總預算不能重複', '❌ 寫入成功');
  exception when others then
    insert into results values (21, '每月總預算不能重複', '✅ ' || sqlerrm);
  end;

  update public.transactions set note = '被改了' where ledger_id = r.alice_ledger;
  get diagnostics cnt = row_count;
  insert into results values (22, '不能修改 Alice 的交易', case when cnt = 0 then '✅' else '❌ 改了 ' || cnt || ' 筆' end);

  delete from public.ledgers where id = r.alice_ledger;
  get diagnostics cnt = row_count;
  insert into results values (23, '不能刪除 Alice 的帳本', case when cnt = 0 then '✅' else '❌ 刪了 ' || cnt || ' 本' end);

  begin
    insert into public.ledger_members (ledger_id, user_id, role)
    values (r.alice_ledger, '00000000-0000-4000-8000-0000000000b1', 'owner');
    insert into results values (24, '不能把自己加進 Alice 的帳本', '❌ 寫入成功');
  exception when others then
    insert into results values (24, '不能把自己加進 Alice 的帳本', '✅ ' || sqlerrm);
  end;

  begin
    update public.ledgers set created_by = '00000000-0000-4000-8000-0000000000a1' where id = r.bob_ledger;
    insert into results values (25, '不能修改帳本的建立者', '❌ 修改成功');
  exception when others then
    insert into results values (25, '不能修改帳本的建立者', '✅ ' || sqlerrm);
  end;

  begin
    insert into public.ledgers (name) values ('旅遊帳本') returning id into new_ledger;
    select count(*) into cnt from public.categories where ledger_id = new_ledger;
    insert into results values (26, 'Bob 可自建第二本帳本並帶入預設分類',
      case when cnt = 16 then '✅' else '❌ 分類數 ' || cnt end);
  exception when others then
    insert into results values (26, 'Bob 可自建第二本帳本並帶入預設分類', '❌ ' || sqlerrm);
  end;
end;
$$;
reset role;

-- ---------------------------------------------------------------------
-- 未登入（anon）：什麼都不能讀
-- ---------------------------------------------------------------------
set local role anon;
do $$
begin
  perform count(*) from public.transactions;
  insert into results values (30, '未登入不能讀取交易', '❌ 讀取成功');
exception when others then
  insert into results values (30, '未登入不能讀取交易', '✅ ' || sqlerrm);
end;
$$;
reset role;

-- ---------------------------------------------------------------------
-- 刪除帳號：Alice 單獨擁有的帳本與資料要一併刪除
-- ---------------------------------------------------------------------
do $$
declare
  alice_ledger uuid := (select alice_ledger from ids);
  cnt int;
begin
  delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
  select (select count(*) from public.ledgers where id = alice_ledger)
       + (select count(*) from public.transactions where ledger_id = alice_ledger)
       + (select count(*) from public.accounts where ledger_id = alice_ledger)
    into cnt;
  insert into results values (40, '刪除帳號後，帳本、帳戶、交易一併刪除', case when cnt = 0 then '✅' else '❌ 剩 ' || cnt || ' 筆' end);
exception when others then
  insert into results values (40, '刪除帳號後，帳本、帳戶、交易一併刪除', '❌ ' || sqlerrm);
end;
$$;

select n, test, outcome from results order by n;

rollback;
