-- =====================================================================
-- KeepMoney 初始資料表
--
-- 結構：所有記帳資料都掛在「帳本 ledgers」底下，權限一律透過
-- ledger_members（誰是哪本帳本的成員、什麼角色）判斷。
-- 目前每位使用者註冊時自動建立一本「我的帳本」；之後要做共用帳本，
-- 只需要開放 ledger_members 的新增流程，不必搬資料。
--
-- 金額一律為正數，收入／支出／轉帳由 type 決定方向。
-- 幣別目前只用新台幣，欄位保留在 ledgers.currency。
-- =====================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- 列舉型別
-- ---------------------------------------------------------------------
create type public.ledger_role as enum ('owner', 'editor', 'viewer');
create type public.account_type as enum ('cash', 'bank', 'credit_card', 'e_wallet', 'investment', 'other');
create type public.category_kind as enum ('expense', 'income');
create type public.transaction_type as enum ('expense', 'income', 'transfer');
create type public.recurrence_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');

-- ---------------------------------------------------------------------
-- 共用：自動更新 updated_at
-- ---------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 使用者資料
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 帳本與成員
-- ---------------------------------------------------------------------
create table public.ledgers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  currency text not null default 'TWD' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ledgers_created_by_idx on public.ledgers (created_by);

create table public.ledger_members (
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.ledger_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

create index ledger_members_user_id_idx on public.ledger_members (user_id);

-- ---------------------------------------------------------------------
-- 帳戶（現金、銀行、信用卡…）
-- 不再使用的帳戶請封存（is_archived），有交易的帳戶無法刪除
-- ---------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  type public.account_type not null default 'cash',
  initial_balance numeric(14, 2) not null default 0,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 讓其他表用 (ledger_id, account_id) 參照，確保不會連到別本帳本的帳戶
  unique (ledger_id, id)
);

-- ---------------------------------------------------------------------
-- 收支分類（可有一層子分類，子分類必須和父分類同帳本、同收支類型）
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  kind public.category_kind not null,
  parent_id uuid,
  name text not null check (char_length(name) between 1 and 30),
  icon text check (char_length(icon) <= 16),
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ledger_id, kind, id),
  foreign key (ledger_id, kind, parent_id) references public.categories (ledger_id, kind, id) on delete cascade,
  check (parent_id <> id)
);

create index categories_parent_idx on public.categories (ledger_id, kind, parent_id);

-- ---------------------------------------------------------------------
-- 標籤
-- ---------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (ledger_id, name),
  unique (ledger_id, id)
);

-- ---------------------------------------------------------------------
-- 定期收支範本（房租、薪水、訂閱…）
-- 依 frequency × interval_count 週期產生交易；next_occurs_on 是下一次要產生的日期
-- ---------------------------------------------------------------------
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  account_id uuid not null,
  to_account_id uuid,
  category_id uuid,
  -- 由 type 推導，用來確保分類的收支類型和交易一致（轉帳為 null）
  category_kind public.category_kind generated always as (
    case type
      when 'expense' then 'expense'::public.category_kind
      when 'income' then 'income'::public.category_kind
    end
  ) stored,
  note text check (char_length(note) <= 200),
  frequency public.recurrence_frequency not null default 'monthly',
  interval_count integer not null default 1 check (interval_count between 1 and 365),
  start_on date not null,
  end_on date,
  next_occurs_on date not null,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ledger_id, id),
  foreign key (ledger_id, account_id) references public.accounts (ledger_id, id),
  foreign key (ledger_id, to_account_id) references public.accounts (ledger_id, id),
  foreign key (ledger_id, category_kind, category_id) references public.categories (ledger_id, kind, id),
  check (end_on is null or end_on >= start_on),
  check (next_occurs_on >= start_on),
  -- 轉帳：要有轉入帳戶、不能有分類；收入／支出：要有分類、不能有轉入帳戶
  constraint recurring_transactions_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id and category_id is null)
    or (type <> 'transfer' and to_account_id is null and category_id is not null)
  )
);

create index recurring_transactions_account_idx on public.recurring_transactions (ledger_id, account_id);
create index recurring_transactions_to_account_idx on public.recurring_transactions (ledger_id, to_account_id);
create index recurring_transactions_category_idx on public.recurring_transactions (ledger_id, category_kind, category_id);
create index recurring_transactions_due_idx on public.recurring_transactions (next_occurs_on) where is_active;
create index recurring_transactions_created_by_idx on public.recurring_transactions (created_by);

-- ---------------------------------------------------------------------
-- 交易
--   expense：從 account_id 支出
--   income：存入 account_id
--   transfer：從 account_id 轉到 to_account_id
-- occurred_on 沒有預設值：資料庫時區是 UTC，日期一律由 App 依使用者當地時間填入
-- ---------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null,
  account_id uuid not null,
  to_account_id uuid,
  category_id uuid,
  category_kind public.category_kind generated always as (
    case type
      when 'expense' then 'expense'::public.category_kind
      when 'income' then 'income'::public.category_kind
    end
  ) stored,
  note text check (char_length(note) <= 200),
  recurring_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ledger_id, id),
  foreign key (ledger_id, account_id) references public.accounts (ledger_id, id),
  foreign key (ledger_id, to_account_id) references public.accounts (ledger_id, id),
  foreign key (ledger_id, category_kind, category_id) references public.categories (ledger_id, kind, id),
  foreign key (ledger_id, recurring_id) references public.recurring_transactions (ledger_id, id) on delete set null (recurring_id),
  constraint transactions_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id and category_id is null)
    or (type <> 'transfer' and to_account_id is null and category_id is not null)
  )
);

create index transactions_ledger_date_idx on public.transactions (ledger_id, occurred_on desc, created_at desc);
create index transactions_account_idx on public.transactions (ledger_id, account_id);
create index transactions_to_account_idx on public.transactions (ledger_id, to_account_id);
create index transactions_category_idx on public.transactions (ledger_id, category_kind, category_id);
create index transactions_recurring_idx on public.transactions (ledger_id, recurring_id);
create index transactions_created_by_idx on public.transactions (created_by);

create table public.transaction_tags (
  ledger_id uuid not null,
  transaction_id uuid not null,
  tag_id uuid not null,
  primary key (transaction_id, tag_id),
  foreign key (ledger_id, transaction_id) references public.transactions (ledger_id, id) on delete cascade,
  foreign key (ledger_id, tag_id) references public.tags (ledger_id, id) on delete cascade
);

create index transaction_tags_transaction_idx on public.transaction_tags (ledger_id, transaction_id);
create index transaction_tags_tag_idx on public.transaction_tags (ledger_id, tag_id);

-- ---------------------------------------------------------------------
-- 每月預算：category_id 為 null 代表整本帳本的每月總預算；只能設在支出分類
-- ---------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  category_id uuid,
  category_kind public.category_kind not null default 'expense' check (category_kind = 'expense'),
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (ledger_id, category_kind, category_id),
  foreign key (ledger_id, category_kind, category_id) references public.categories (ledger_id, kind, id) on delete cascade
);

-- ---------------------------------------------------------------------
-- 帳戶餘額 = 期初餘額 + 收入 + 轉入 − 支出 − 轉出
-- security_invoker：查詢時套用呼叫者的 RLS，只會算到自己看得到的交易
-- ---------------------------------------------------------------------
create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.ledger_id,
  a.initial_balance + coalesce(sum(m.delta), 0) as balance
from public.accounts a
left join (
  select t.account_id, case t.type when 'income' then t.amount else -t.amount end as delta
  from public.transactions t
  union all
  select t.to_account_id, t.amount
  from public.transactions t
  where t.type = 'transfer'
) m on m.account_id = a.id
group by a.id;

-- ---------------------------------------------------------------------
-- updated_at 觸發器
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.ledgers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.accounts
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.recurring_transactions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.transactions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.budgets
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- 新帳本：建立者自動成為擁有者，並建立預設帳戶與分類
-- ---------------------------------------------------------------------
create function private.handle_new_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.ledger_members (ledger_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;

  insert into public.accounts (ledger_id, name, type)
  values (new.id, '現金', 'cash');

  insert into public.categories (ledger_id, kind, name, icon, sort_order)
  select new.id, c.kind::public.category_kind, c.name, c.icon, c.sort_order
  from (
    values
      ('expense', '飲食', '🍱', 1),
      ('expense', '交通', '🚌', 2),
      ('expense', '購物', '🛍️', 3),
      ('expense', '日用品', '🧴', 4),
      ('expense', '居家', '🏠', 5),
      ('expense', '帳單', '🧾', 6),
      ('expense', '娛樂', '🎮', 7),
      ('expense', '醫療', '💊', 8),
      ('expense', '教育', '📚', 9),
      ('expense', '社交', '🎉', 10),
      ('expense', '其他', '📦', 99),
      ('income', '薪資', '💼', 1),
      ('income', '獎金', '🎁', 2),
      ('income', '投資', '📈', 3),
      ('income', '兼職', '🧑‍💻', 4),
      ('income', '其他', '💰', 99)
  ) as c (kind, name, icon, sort_order);

  return new;
end;
$$;

create trigger on_ledger_created
  after insert on public.ledgers
  for each row execute function private.handle_new_ledger();

-- ---------------------------------------------------------------------
-- 新使用者：建立個人資料與第一本帳本
-- ---------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 50)
  );

  insert into public.ledgers (name, created_by)
  values ('我的帳本', new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- 刪除使用者（App Store 要求提供刪除帳號）：
-- 一併刪除「只有他一位擁有者」的帳本與其中所有資料
-- ---------------------------------------------------------------------
create function private.handle_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.ledgers l
  where exists (
    select 1 from public.ledger_members m
    where m.ledger_id = l.id and m.user_id = old.id and m.role = 'owner'
  )
  and not exists (
    select 1 from public.ledger_members m
    where m.ledger_id = l.id and m.user_id <> old.id and m.role = 'owner'
  );

  return old;
end;
$$;

create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function private.handle_user_deleted();

-- ---------------------------------------------------------------------
-- RLS 輔助函式：目前登入者能讀／能寫／擁有的帳本
-- security definer 讓函式查 ledger_members 時不受 RLS 影響（避免遞迴）
-- ---------------------------------------------------------------------
create function private.readable_ledger_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ledger_id from public.ledger_members where user_id = (select auth.uid());
$$;

create function private.writable_ledger_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ledger_id from public.ledger_members
  where user_id = (select auth.uid()) and role in ('owner', 'editor');
$$;

create function private.owned_ledger_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ledger_id from public.ledger_members
  where user_id = (select auth.uid()) and role = 'owner';
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.readable_ledger_ids(),
  private.writable_ledger_ids(),
  private.owned_ledger_ids()
to authenticated;

-- ---------------------------------------------------------------------
-- 權限：未登入（anon）完全不能碰；登入者（authenticated）再由 RLS 限制到自己的帳本
-- ---------------------------------------------------------------------
revoke all on
  public.profiles, public.ledgers, public.ledger_members, public.accounts, public.categories,
  public.tags, public.recurring_transactions, public.transactions, public.transaction_tags,
  public.budgets, public.account_balances
from anon, authenticated;

grant select, update (display_name) on public.profiles to authenticated;
grant select, insert (name, currency), update (name, currency), delete on public.ledgers to authenticated;
grant select on public.ledger_members to authenticated;
grant select, insert, update, delete on
  public.accounts, public.categories, public.tags, public.recurring_transactions,
  public.transactions, public.transaction_tags, public.budgets
to authenticated;
grant select on public.account_balances to authenticated;

alter table public.profiles enable row level security;
alter table public.ledgers enable row level security;
alter table public.ledger_members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_tags enable row level security;
alter table public.budgets enable row level security;

-- 個人資料：只能看、改自己的
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 帳本：成員可看；任何登入者可建立自己的帳本；只有擁有者能改名、刪除
-- （select 加上 created_by 判斷，是因為 insert ... returning 檢查時擁有者成員資料還沒寫入）
create policy "ledgers_select_member" on public.ledgers
  for select to authenticated
  using (id in (select private.readable_ledger_ids()) or created_by = (select auth.uid()));
create policy "ledgers_insert_self" on public.ledgers
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "ledgers_update_owner" on public.ledgers
  for update to authenticated
  using (id in (select private.owned_ledger_ids()))
  with check (id in (select private.owned_ledger_ids()));
create policy "ledgers_delete_owner" on public.ledgers
  for delete to authenticated using (id in (select private.owned_ledger_ids()));

-- 帳本成員：成員可看同帳本的成員名單；新增／移除成員等做共用帳本時再開放
create policy "ledger_members_select_member" on public.ledger_members
  for select to authenticated using (ledger_id in (select private.readable_ledger_ids()));

-- 帳本內的資料：成員都能看；owner／editor 才能新增、修改、刪除
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'tags', 'recurring_transactions',
    'transactions', 'transaction_tags', 'budgets'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (ledger_id in (select private.readable_ledger_ids()))',
      t || '_select_member', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (ledger_id in (select private.writable_ledger_ids()))',
      t || '_insert_editor', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (ledger_id in (select private.writable_ledger_ids()))
         with check (ledger_id in (select private.writable_ledger_ids()))',
      t || '_update_editor', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (ledger_id in (select private.writable_ledger_ids()))',
      t || '_delete_editor', t);
  end loop;
end;
$$;
