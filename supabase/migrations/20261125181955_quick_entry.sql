-- =====================================================================
-- 快速記帳
--
-- 讓使用者在 iPhone 捷徑（或 Siri）說「午餐 120」就能記一筆帳：
-- 捷徑 → Edge Function（解析文字）→ 用 publishable（anon）key 呼叫 public.quick_add，
-- 以使用者自己產生的「捷徑金鑰」驗證身分，直接寫入 transactions 並標記為「待確認」，
-- 之後再到 App 補細節。
--
-- 捷徑金鑰只存 sha256 雜湊，明文只在建立當下回傳一次，之後無法再取得。
-- anon 不能直接讀寫任何資料表，唯一的入口是 quick_add（security definer）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 加密函式（digest()、gen_random_bytes()）
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 交易新增兩個欄位
--   needs_review：待確認（快速記帳先記下來，之後在 App 補分類、帳戶、備註）
--   source：來源（App 內記帳、快速記帳、捷徑、發票 QR、匯入）
-- 表層級的 grant 與 RLS policy 自動涵蓋新欄位
-- ---------------------------------------------------------------------
create type public.transaction_source as enum ('app', 'quick', 'shortcut', 'invoice_qr', 'import');

alter table public.transactions
  add column needs_review boolean not null default false,
  add column source public.transaction_source not null default 'app';

create index transactions_needs_review_idx on public.transactions (ledger_id, occurred_on desc) where needs_review;

-- ---------------------------------------------------------------------
-- 捷徑金鑰
-- token_hash 是明文金鑰的 sha256（hex）；明文永遠不存
-- default_account_id：這把金鑰記帳時預設使用的帳戶（可空，空則用第一個未封存帳戶）
-- ---------------------------------------------------------------------
create table public.quick_entry_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  token_hash text not null unique,
  label text check (char_length(label) <= 30),
  default_account_id uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- 預設帳戶必須屬於同一本帳本；帳戶被刪除時只清掉預設帳戶，金鑰仍可使用
  foreign key (ledger_id, default_account_id) references public.accounts (ledger_id, id) on delete set null (default_account_id)
);

create index quick_entry_tokens_user_idx on public.quick_entry_tokens (user_id);
create index quick_entry_tokens_account_idx on public.quick_entry_tokens (ledger_id, default_account_id);

-- 權限：不能 insert（只能透過 create_quick_entry_token 建立）；token_hash 不開放讀取
revoke all on public.quick_entry_tokens from anon, authenticated;
grant select (id, ledger_id, label, default_account_id, created_at, last_used_at) on public.quick_entry_tokens to authenticated;
grant update (label, default_account_id) on public.quick_entry_tokens to authenticated;
grant delete on public.quick_entry_tokens to authenticated;

alter table public.quick_entry_tokens enable row level security;

-- 只能看、改、刪自己的金鑰；改預設帳戶時，帳本仍要是自己可寫入的
create policy "quick_entry_tokens_select_own" on public.quick_entry_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "quick_entry_tokens_update_own" on public.quick_entry_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and ledger_id in (select private.writable_ledger_ids()));
create policy "quick_entry_tokens_delete_own" on public.quick_entry_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 建立捷徑金鑰：回傳明文金鑰（只有這一次看得到）
-- ---------------------------------------------------------------------
create function public.create_quick_entry_token(
  p_ledger_id uuid,
  p_label text default null,
  p_default_account_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_token text;
begin
  if uid is null then
    raise exception '需要登入' using errcode = '42501';
  end if;

  if p_ledger_id is null or p_ledger_id not in (select private.writable_ledger_ids()) then
    raise exception '沒有這本帳本的記帳權限' using errcode = '42501';
  end if;

  if p_default_account_id is not null and not exists (
    select 1 from public.accounts a
    where a.id = p_default_account_id and a.ledger_id = p_ledger_id and not a.is_archived
  ) then
    raise exception '預設帳戶不存在、已封存或不屬於這本帳本';
  end if;

  -- 同一位使用者的建立動作排隊，避免同時建立而超過上限
  perform pg_advisory_xact_lock(hashtextextended('quick_entry_tokens:' || uid::text, 0));

  if (select count(*) from public.quick_entry_tokens where user_id = uid) >= 5 then
    raise exception '最多只能建立 5 把捷徑金鑰，請先刪除不用的';
  end if;

  v_token := 'km_' || encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.quick_entry_tokens (user_id, ledger_id, token_hash, label, default_account_id)
  values (
    uid,
    p_ledger_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    left(nullif(trim(p_label), ''), 30),
    p_default_account_id
  );

  return v_token;
end;
$$;

revoke all on function public.create_quick_entry_token(uuid, text, uuid) from public, anon;
grant execute on function public.create_quick_entry_token(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 快速記帳：用捷徑金鑰寫入一筆「待確認」的支出或收入
-- anon 也能呼叫（Edge Function 只用 publishable key），身分完全由金鑰決定。
-- 錯誤訊息會直接顯示在 iPhone 通知，所以都寫成使用者看得懂的中文。
-- ---------------------------------------------------------------------
create function public.quick_add(
  p_token text,
  p_type public.transaction_type,
  p_amount numeric,
  p_occurred_on date,
  p_note text default null,
  p_category_name text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.quick_entry_tokens;
  v_note text := left(nullif(trim(p_note), ''), 200);
  v_cat_name text := nullif(trim(p_category_name), '');
  v_kind public.category_kind;
  v_account_id uuid;
  v_account_name text;
  v_category_id uuid;
  v_category_name text;
  v_id uuid;
begin
  -- 1. 驗證金鑰（只比對雜湊）
  select * into v_key
  from public.quick_entry_tokens
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  if not found then
    raise exception '捷徑金鑰無效或已撤銷，請到 App 的設定重新產生' using errcode = '28000';
  end if;

  -- 2. 金鑰的主人必須仍是帳本的擁有者或編輯者
  if not exists (
    select 1 from public.ledger_members m
    where m.ledger_id = v_key.ledger_id and m.user_id = v_key.user_id and m.role in ('owner', 'editor')
  ) then
    raise exception '這把金鑰的主人已沒有這本帳本的記帳權限' using errcode = '42501';
  end if;

  -- 3. 輸入驗證
  if p_type is null or p_type = 'transfer' then
    raise exception '快速記帳只支援支出與收入';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception '金額必須大於 0';
  end if;
  if p_amount > 999999999999.99 then
    raise exception '金額太大了';
  end if;
  if p_amount <> round(p_amount, 2) then
    raise exception '金額最多只能到小數點後兩位';
  end if;

  if p_occurred_on is null or p_occurred_on < current_date - 366 or p_occurred_on > current_date + 1 then
    raise exception '日期必須在最近一年內，且不能是未來';
  end if;

  -- 4. 頻率限制：每位使用者每分鐘最多 20 筆捷徑記帳
  if (
    select count(*) from public.transactions t
    where t.created_by = v_key.user_id and t.source = 'shortcut' and t.created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception '記太快了，請稍後再試';
  end if;

  -- 5. 帳戶：金鑰的預設帳戶；否則帳本裡第一個未封存的帳戶
  select a.id, a.name into v_account_id, v_account_name
  from public.accounts a
  where a.id = v_key.default_account_id and a.ledger_id = v_key.ledger_id and not a.is_archived;

  if v_account_id is null then
    select a.id, a.name into v_account_id, v_account_name
    from public.accounts a
    where a.ledger_id = v_key.ledger_id and not a.is_archived
    order by a.sort_order, a.created_at, a.id
    limit 1;
  end if;

  if v_account_id is null then
    raise exception '帳本裡沒有可用的帳戶';
  end if;

  -- 6. 分類：名稱相符（不分大小寫、上層分類優先）→「其他」→ 該類型的第一個上層分類
  v_kind := p_type::text::public.category_kind;

  if v_cat_name is not null then
    select c.id, c.name into v_category_id, v_category_name
    from public.categories c
    where c.ledger_id = v_key.ledger_id and c.kind = v_kind and not c.is_archived
      and lower(c.name) = lower(v_cat_name)
    order by c.parent_id is not null, c.sort_order, c.created_at, c.id
    limit 1;
  end if;

  if v_category_id is null then
    select c.id, c.name into v_category_id, v_category_name
    from public.categories c
    where c.ledger_id = v_key.ledger_id and c.kind = v_kind and not c.is_archived
      and c.parent_id is null and c.name = '其他'
    order by c.sort_order, c.created_at, c.id
    limit 1;
  end if;

  if v_category_id is null then
    select c.id, c.name into v_category_id, v_category_name
    from public.categories c
    where c.ledger_id = v_key.ledger_id and c.kind = v_kind and not c.is_archived
      and c.parent_id is null
    order by c.sort_order, c.created_at, c.id
    limit 1;
  end if;

  if v_category_id is null then
    raise exception '帳本裡沒有可用的分類';
  end if;

  -- 7. 寫入交易（待確認，來源為捷徑）
  insert into public.transactions (
    ledger_id, type, amount, occurred_on, account_id, category_id, note,
    needs_review, source, created_by
  )
  values (
    v_key.ledger_id, p_type, p_amount, p_occurred_on, v_account_id, v_category_id, v_note,
    true, 'shortcut', v_key.user_id
  )
  returning id into v_id;

  -- 8. 記錄金鑰最後使用時間
  update public.quick_entry_tokens set last_used_at = now() where id = v_key.id;

  return json_build_object(
    'id', v_id,
    'type', p_type,
    'amount', p_amount,
    'occurred_on', p_occurred_on,
    'category_name', v_category_name,
    'account_name', v_account_name
  );
end;
$$;

revoke all on function public.quick_add(text, public.transaction_type, numeric, date, text, text) from public;
grant execute on function public.quick_add(text, public.transaction_type, numeric, date, text, text) to anon, authenticated;
