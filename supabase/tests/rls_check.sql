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
-- 快速記帳：捷徑金鑰與 quick_add
-- ---------------------------------------------------------------------
-- 暫存 Alice 建立的明文金鑰，供後面的測試使用
create temp table qtoken (token text);
grant select, insert on qtoken to authenticated, anon;

-- Alice：建立金鑰、只能讀到非機密欄位
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  t text;
  cnt int;
  lbl text;
begin
  begin
    t := public.create_quick_entry_token((select alice_ledger from ids), '我的 iPhone');
    insert into qtoken values (t);
    insert into results values (31, 'Alice 建立捷徑金鑰：km_ 開頭、長度 51',
      case when left(t, 3) = 'km_' and length(t) = 51 then '✅' else '❌ ' || coalesce(t, 'null') end);
  exception when others then
    insert into results values (31, 'Alice 建立捷徑金鑰：km_ 開頭、長度 51', '❌ ' || sqlerrm);
  end;

  begin
    perform token_hash from public.quick_entry_tokens;
    insert into results values (32, 'Alice 不能讀取 token_hash 欄位', '❌ 讀取成功');
  exception when insufficient_privilege then
    insert into results values (32, 'Alice 不能讀取 token_hash 欄位', '✅ ' || sqlerrm);
  when others then
    insert into results values (32, 'Alice 不能讀取 token_hash 欄位', '❌ ' || sqlerrm);
  end;

  select count(*), min(label) into cnt, lbl from public.quick_entry_tokens;
  insert into results values (33, 'Alice 讀得到自己的 1 把金鑰（id、label）',
    case when cnt = 1 and lbl = '我的 iPhone' then '✅' else format('❌ %s 把／%s', cnt, lbl) end);
end;
$$;
reset role;

-- Bob：不能替 Alice 的帳本建立金鑰，也看不到 Alice 的金鑰
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  cnt int;
begin
  begin
    perform public.create_quick_entry_token((select alice_ledger from ids), 'Bob 偷建的');
    insert into results values (34, 'Bob 不能替 Alice 的帳本建立金鑰', '❌ 建立成功');
  exception when others then
    insert into results values (34, 'Bob 不能替 Alice 的帳本建立金鑰',
      case when sqlstate = '42501' then '✅ ' || sqlerrm else '❌ ' || sqlerrm end);
  end;

  select count(*) into cnt from public.quick_entry_tokens;
  insert into results values (35, 'Bob 看不到 Alice 的金鑰', case when cnt = 0 then '✅' else '❌ ' || cnt end);
end;
$$;
reset role;

-- 未登入（anon）：只能透過 quick_add 記帳
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  t text := (select token from qtoken);
  res json;
begin
  begin
    res := public.quick_add(t, 'expense', 120, current_date, '午餐', '飲食');
    insert into results values (36, 'anon 用金鑰快速記帳成功',
      case when res ->> 'category_name' = '飲食' and (res ->> 'amount')::numeric = 120
                and res ->> 'account_name' is not null
           then '✅' else '❌ ' || res::text end);
  exception when others then
    insert into results values (36, 'anon 用金鑰快速記帳成功', '❌ ' || sqlerrm);
  end;

  begin
    res := public.quick_add(t, 'expense', 50, current_date, null, '不存在的分類');
    insert into results values (38, '找不到分類名稱時，落在「其他」',
      case when res ->> 'category_name' = '其他' then '✅' else '❌ ' || res::text end);
  exception when others then
    insert into results values (38, '找不到分類名稱時，落在「其他」', '❌ ' || sqlerrm);
  end;

  begin
    res := public.quick_add(t, 'expense', 30, current_date, null, ' 早餐 ');
    insert into results values (39, '分類名稱可對到子分類（忽略前後空白）',
      case when res ->> 'category_name' = '早餐' then '✅' else '❌ ' || res::text end);
  exception when others then
    insert into results values (39, '分類名稱可對到子分類（忽略前後空白）', '❌ ' || sqlerrm);
  end;

  begin
    perform public.quick_add('km_' || repeat('0', 48), 'expense', 10, current_date, null, null);
    insert into results values (41, '錯誤的金鑰不能記帳', '❌ 記帳成功');
  exception when others then
    insert into results values (41, '錯誤的金鑰不能記帳',
      case when sqlstate = '28000' then '✅ ' || sqlerrm else '❌ ' || sqlerrm end);
  end;

  begin
    perform public.quick_add(null, 'expense', 10, current_date, null, null);
    insert into results values (42, '沒有金鑰不能記帳', '❌ 記帳成功');
  exception when others then
    insert into results values (42, '沒有金鑰不能記帳',
      case when sqlstate = '28000' then '✅ ' || sqlerrm else '❌ ' || sqlerrm end);
  end;

  begin
    perform public.quick_add(t, 'transfer', 10, current_date, null, null);
    insert into results values (43, '快速記帳不能記轉帳', '❌ 記帳成功');
  exception when others then
    insert into results values (43, '快速記帳不能記轉帳', '✅ ' || sqlerrm);
  end;

  begin
    perform public.quick_add(t, 'expense', 0, current_date, null, null);
    insert into results values (44, '快速記帳金額不能是 0', '❌ 記帳成功');
  exception when others then
    insert into results values (44, '快速記帳金額不能是 0', '✅ ' || sqlerrm);
  end;

  begin
    perform public.quick_add(t, 'expense', 10.123, current_date, null, null);
    insert into results values (45, '快速記帳金額不能超過兩位小數', '❌ 記帳成功');
  exception when others then
    insert into results values (45, '快速記帳金額不能超過兩位小數', '✅ ' || sqlerrm);
  end;

  begin
    perform public.quick_add(t, 'expense', 10, current_date + 10, null, null);
    insert into results values (46, '快速記帳日期不能是未來', '❌ 記帳成功');
  exception when others then
    insert into results values (46, '快速記帳日期不能是未來', '✅ ' || sqlerrm);
  end;

  begin
    perform public.quick_add(t, 'expense', 10, current_date - 400, null, null);
    insert into results values (47, '快速記帳日期不能早於一年前', '❌ 記帳成功');
  exception when others then
    insert into results values (47, '快速記帳日期不能早於一年前', '✅ ' || sqlerrm);
  end;

  begin
    perform count(*) from public.transactions;
    insert into results values (48, 'anon 不能直接讀取交易', '❌ 讀取成功');
  exception when insufficient_privilege then
    insert into results values (48, 'anon 不能直接讀取交易', '✅ ' || sqlerrm);
  when others then
    insert into results values (48, 'anon 不能直接讀取交易', '❌ ' || sqlerrm);
  end;

  begin
    perform count(*) from public.quick_entry_tokens;
    insert into results values (49, 'anon 不能直接讀取捷徑金鑰', '❌ 讀取成功');
  exception when insufficient_privilege then
    insert into results values (49, 'anon 不能直接讀取捷徑金鑰', '✅ ' || sqlerrm);
  when others then
    insert into results values (49, 'anon 不能直接讀取捷徑金鑰', '❌ ' || sqlerrm);
  end;
end;
$$;
reset role;

-- 以管理者身分檢查寫入的交易（預期的帳戶用查詢取得，不寫死）
do $$
declare
  r record;
  l uuid := (select alice_ledger from ids);
  exp_account uuid;
  used timestamptz;
begin
  select a.id into exp_account
  from public.accounts a
  where a.ledger_id = l and not a.is_archived
  order by a.sort_order, a.created_at, a.id
  limit 1;

  select t.needs_review, t.source, t.created_by, t.account_id, t.amount, t.occurred_on, t.note, t.ledger_id, c.name as category_name
    into r
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.ledger_id = l and t.note = '午餐';

  insert into results values (37, '快速記帳的交易：待確認、來源 shortcut、建立者 Alice、分類「飲食」、預設帳戶',
    case when r.needs_review and r.source = 'shortcut'
              and r.created_by = '00000000-0000-4000-8000-0000000000a1'
              and r.category_name = '飲食' and r.account_id = exp_account
              and r.amount = 120 and r.occurred_on = current_date
         then '✅' else '❌ ' || coalesce(r::text, 'null') end);

  select last_used_at into used from public.quick_entry_tokens
  where user_id = '00000000-0000-4000-8000-0000000000a1';
  insert into results values (50, '快速記帳後更新金鑰的最後使用時間', case when used is not null then '✅' else '❌' end);
end;
$$;

-- 頻率限制：補到每分鐘 20 筆後，第 21 筆要被擋下
insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id, needs_review, source, created_by)
select t.ledger_id, 'expense', 1, current_date, t.account_id, t.category_id, true, 'shortcut', t.created_by
from public.transactions t, generate_series(1, 17)
where t.note = '午餐';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  perform public.quick_add((select token from qtoken), 'expense', 10, current_date, null, null);
  insert into results values (51, '每分鐘超過 20 筆快速記帳要被擋下', '❌ 記帳成功');
exception when others then
  insert into results values (51, '每分鐘超過 20 筆快速記帳要被擋下',
    case when sqlerrm like '記太快了%' then '✅ ' || sqlerrm else '❌ ' || sqlerrm end);
end;
$$;
reset role;

-- ---------------------------------------------------------------------
-- 拍照記帳：發票號碼唯一、收據路徑限制、私有 bucket 與 policy
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  r record;
  acct uuid := (select id from public.accounts where name = '現金');
  cat uuid := (select id from public.categories where name = '飲食');
  bad text;
  blocked int;
begin
  select * into r from ids;

  begin
    insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id, invoice_number)
    values (r.alice_ledger, 'expense', 85, '2026-11-25', acct, cat, 'AB12345678');
    insert into results values (52, '帶發票號碼的支出可以新增', '✅');
  exception when others then
    insert into results values (52, '帶發票號碼的支出可以新增', '❌ ' || sqlerrm);
  end;

  begin
    insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id, invoice_number)
    values (r.alice_ledger, 'expense', 85, '2026-11-25', acct, cat, 'AB12345678');
    insert into results values (53, '同一帳本不能重複記同一張發票', '❌ 寫入成功');
  exception
    when unique_violation then
      insert into results values (53, '同一帳本不能重複記同一張發票', '✅ ' || sqlerrm);
    when others then
      insert into results values (53, '同一帳本不能重複記同一張發票', '❌ ' || sqlerrm);
  end;

  -- 小寫、位數不足：兩種格式錯誤都要被 check 擋下
  blocked := 0;
  foreach bad in array array['ab12345678', 'AB1234567'] loop
    begin
      insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id, invoice_number)
      values (r.alice_ledger, 'expense', 85, '2026-11-25', acct, cat, bad);
    exception when check_violation then
      blocked := blocked + 1;
    end;
  end loop;
  insert into results values (54, '發票號碼格式錯誤要被擋下（小寫、位數不足）',
    case when blocked = 2 then '✅' else '❌ 只擋下 ' || blocked || ' 種' end);

  begin
    insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id, receipt_path)
    values (r.alice_ledger, 'expense', 85, '2026-11-25', acct, cat, r.alice_ledger::text || '/x/y.jpg');
    insert into results values (55, '收據路徑指向自己的帳本可以新增', '✅');
  exception when others then
    insert into results values (55, '收據路徑指向自己的帳本可以新增', '❌ ' || sqlerrm);
  end;

  begin
    insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id, receipt_path)
    values (r.alice_ledger, 'expense', 85, '2026-11-25', acct, cat, r.bob_ledger::text || '/x/y.jpg');
    insert into results values (56, '收據路徑不能指向別本帳本', '❌ 寫入成功');
  exception
    when check_violation then
      insert into results values (56, '收據路徑不能指向別本帳本', '✅ ' || sqlerrm);
    when others then
      insert into results values (56, '收據路徑不能指向別本帳本', '❌ ' || sqlerrm);
  end;
end;
$$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  r record;
begin
  select * into r from ids;

  begin
    insert into public.transactions (ledger_id, type, amount, occurred_on, account_id, category_id, invoice_number)
    values (r.bob_ledger, 'expense', 85, '2026-11-25', r.bob_cash, r.bob_food, 'AB12345678');
    insert into results values (57, 'Bob 在自己的帳本可用同一個發票號碼（不同帳本互不影響）', '✅');
  exception when others then
    insert into results values (57, 'Bob 在自己的帳本可用同一個發票號碼（不同帳本互不影響）', '❌ ' || sqlerrm);
  end;
end;
$$;
reset role;

do $$
declare
  cnt int;
begin
  select count(*) into cnt from storage.buckets where id = 'receipts' and public = false;
  insert into results values (58, 'receipts bucket 存在且為私有', case when cnt = 1 then '✅' else '❌ 符合的 bucket 數 ' || cnt end);

  -- 4 個 policy（select／insert／update／delete），且只開放給 authenticated（anon 沒有）
  select count(*) into cnt from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'receipts\_%'
    and roles = array['authenticated']::name[];
  insert into results values (59, 'storage.objects 有 4 個 receipts_ policy 且只給 authenticated',
    case when cnt = 4 then '✅' else '❌ ' || cnt end);
end;
$$;

-- ---------------------------------------------------------------------
-- 刪除帳號：Alice 單獨擁有的帳本與資料要一併刪除
-- ---------------------------------------------------------------------
do $$
declare
  alice_ledger uuid := (select alice_ledger from ids);
  cnt int;
  tokens_before int;
  tokens_after int;
begin
  select count(*) into tokens_before from public.quick_entry_tokens
  where user_id = '00000000-0000-4000-8000-0000000000a1';

  delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
  select (select count(*) from public.ledgers where id = alice_ledger)
       + (select count(*) from public.transactions where ledger_id = alice_ledger)
       + (select count(*) from public.accounts where ledger_id = alice_ledger)
    into cnt;
  insert into results values (60, '刪除帳號後，帳本、帳戶、交易一併刪除', case when cnt = 0 then '✅' else '❌ 剩 ' || cnt || ' 筆' end);

  select count(*) into tokens_after from public.quick_entry_tokens
  where user_id = '00000000-0000-4000-8000-0000000000a1';
  insert into results values (61, '刪除帳號後，捷徑金鑰一併刪除',
    case when tokens_before > 0 and tokens_after = 0 then '✅' else format('❌ 刪除前 %s／刪除後 %s', tokens_before, tokens_after) end);
exception when others then
  insert into results values (60, '刪除帳號後，帳本、帳戶、交易、捷徑金鑰一併刪除', '❌ ' || sqlerrm);
end;
$$;

select n, test, outcome from results order by n;

rollback;
