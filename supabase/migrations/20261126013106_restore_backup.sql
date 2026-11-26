-- =====================================================================
-- 從備份還原
--
-- App 讀取備份檔（JSON）、整理成還原計畫後，一次呼叫 public.restore_backup 寫入。
-- 整個函式就是一個資料庫交易：任何一筆違反約束（例如分類類型不符、引用不存在的帳戶）
-- 整批就會失敗、什麼都不會寫入；錯誤訊息保持資料庫原本的，由 App 轉成中文。
--
-- 設計重點：
--   * security invoker：用呼叫者的身分寫入，所有 RLS 照常生效。
--   * 一律寫進 p_ledger_id，忽略 payload 內的 ledger_id（避免寫到別本帳本）。
--   * 每個 insert 都 on conflict do nothing（不指定衝突目標）：主鍵、發票號碼唯一索引、
--     預算唯一限制衝突時略過，所以同一份備份重複還原不會重複寫入。
--   * created_by 不寫（用欄位預設 auth.uid()）；receipt_path 一律 null（照片不在備份裡）。
--   * 用 jsonb_to_recordset 明確列出欄位：不能用 jsonb_populate_recordset(null::transactions)，
--     因為 category_kind 是 generated 欄位，不能寫入。
-- =====================================================================
create function public.restore_backup(p_ledger_id uuid, p_payload jsonb)
returns json
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_accounts jsonb;
  v_categories jsonb;
  v_tags jsonb;
  v_recurring jsonb;
  v_transactions jsonb;
  v_transaction_tags jsonb;
  v_budgets jsonb;
  n_accounts int;
  n_categories int;
  n_categories_children int;
  n_tags int;
  n_recurring int;
  n_transactions int;
  n_transaction_tags int;
  n_budgets int;
begin
  if p_ledger_id is null or p_ledger_id not in (select private.writable_ledger_ids()) then
    raise exception '沒有這本帳本的寫入權限' using errcode = '42501';
  end if;

  -- 缺少的鍵（或不是陣列）當空陣列
  v_accounts := case when jsonb_typeof(v_payload -> 'accounts') = 'array' then v_payload -> 'accounts' else '[]'::jsonb end;
  v_categories := case when jsonb_typeof(v_payload -> 'categories') = 'array' then v_payload -> 'categories' else '[]'::jsonb end;
  v_tags := case when jsonb_typeof(v_payload -> 'tags') = 'array' then v_payload -> 'tags' else '[]'::jsonb end;
  v_recurring := case when jsonb_typeof(v_payload -> 'recurring_transactions') = 'array' then v_payload -> 'recurring_transactions' else '[]'::jsonb end;
  v_transactions := case when jsonb_typeof(v_payload -> 'transactions') = 'array' then v_payload -> 'transactions' else '[]'::jsonb end;
  v_transaction_tags := case when jsonb_typeof(v_payload -> 'transaction_tags') = 'array' then v_payload -> 'transaction_tags' else '[]'::jsonb end;
  v_budgets := case when jsonb_typeof(v_payload -> 'budgets') = 'array' then v_payload -> 'budgets' else '[]'::jsonb end;

  -- 防呆：避免一次塞入過大的資料
  if jsonb_array_length(v_transactions) > 50000 then
    raise exception '備份太大，請聯絡開發者';
  end if;

  -- 帳戶
  insert into public.accounts (id, ledger_id, name, type, initial_balance, is_archived, sort_order, created_at)
  select x.id, p_ledger_id, x.name, x.type, x.initial_balance, x.is_archived, x.sort_order, coalesce(x.created_at, now())
  from jsonb_to_recordset(v_accounts) as x (
    id uuid,
    name text,
    type public.account_type,
    initial_balance numeric,
    is_archived boolean,
    sort_order integer,
    created_at timestamptz
  )
  on conflict do nothing;
  get diagnostics n_accounts = row_count;

  -- 分類：先寫上層（parent_id 為空），再寫子分類（外鍵要求上層已存在）
  insert into public.categories (id, ledger_id, kind, parent_id, name, icon, color, sort_order, is_archived, created_at)
  select x.id, p_ledger_id, x.kind, null, x.name, x.icon, x.color, x.sort_order, x.is_archived, coalesce(x.created_at, now())
  from jsonb_to_recordset(v_categories) as x (
    id uuid,
    kind public.category_kind,
    parent_id uuid,
    name text,
    icon text,
    color text,
    sort_order integer,
    is_archived boolean,
    created_at timestamptz
  )
  where x.parent_id is null
  on conflict do nothing;
  get diagnostics n_categories = row_count;

  insert into public.categories (id, ledger_id, kind, parent_id, name, icon, color, sort_order, is_archived, created_at)
  select x.id, p_ledger_id, x.kind, x.parent_id, x.name, x.icon, x.color, x.sort_order, x.is_archived, coalesce(x.created_at, now())
  from jsonb_to_recordset(v_categories) as x (
    id uuid,
    kind public.category_kind,
    parent_id uuid,
    name text,
    icon text,
    color text,
    sort_order integer,
    is_archived boolean,
    created_at timestamptz
  )
  where x.parent_id is not null
  on conflict do nothing;
  get diagnostics n_categories_children = row_count;
  n_categories := n_categories + n_categories_children;

  -- 標籤
  insert into public.tags (id, ledger_id, name, color, created_at)
  select x.id, p_ledger_id, x.name, x.color, coalesce(x.created_at, now())
  from jsonb_to_recordset(v_tags) as x (
    id uuid,
    name text,
    color text,
    created_at timestamptz
  )
  on conflict do nothing;
  get diagnostics n_tags = row_count;

  -- 定期收支（交易的 recurring_id 會參照它，所以先寫）
  insert into public.recurring_transactions (
    id, ledger_id, type, amount, account_id, to_account_id, category_id, note,
    frequency, interval_count, start_on, end_on, next_occurs_on, is_active, created_at
  )
  select
    x.id, p_ledger_id, x.type, x.amount, x.account_id, x.to_account_id, x.category_id, x.note,
    x.frequency, x.interval_count, x.start_on, x.end_on, x.next_occurs_on, x.is_active, coalesce(x.created_at, now())
  from jsonb_to_recordset(v_recurring) as x (
    id uuid,
    type public.transaction_type,
    amount numeric,
    account_id uuid,
    to_account_id uuid,
    category_id uuid,
    note text,
    frequency public.recurrence_frequency,
    interval_count integer,
    start_on date,
    end_on date,
    next_occurs_on date,
    is_active boolean,
    created_at timestamptz
  )
  on conflict do nothing;
  get diagnostics n_recurring = row_count;

  -- 交易（receipt_path 一律 null；category_kind 是 generated 欄位，不寫）
  insert into public.transactions (
    id, ledger_id, type, amount, occurred_on, account_id, to_account_id, category_id, note,
    recurring_id, invoice_number, needs_review, source, receipt_path, created_at
  )
  select
    x.id, p_ledger_id, x.type, x.amount, x.occurred_on, x.account_id, x.to_account_id, x.category_id, x.note,
    x.recurring_id, x.invoice_number, coalesce(x.needs_review, false), coalesce(x.source, 'app'::public.transaction_source),
    null, coalesce(x.created_at, now())
  from jsonb_to_recordset(v_transactions) as x (
    id uuid,
    type public.transaction_type,
    amount numeric,
    occurred_on date,
    account_id uuid,
    to_account_id uuid,
    category_id uuid,
    note text,
    recurring_id uuid,
    invoice_number text,
    needs_review boolean,
    source public.transaction_source,
    created_at timestamptz
  )
  on conflict do nothing;
  get diagnostics n_transactions = row_count;

  -- 交易標籤：只寫入交易與標籤都確實存在於這本帳本的列（交易可能因衝突被略過）
  insert into public.transaction_tags (ledger_id, transaction_id, tag_id)
  select p_ledger_id, x.transaction_id, x.tag_id
  from jsonb_to_recordset(v_transaction_tags) as x (
    transaction_id uuid,
    tag_id uuid
  )
  where exists (
      select 1 from public.transactions t
      where t.id = x.transaction_id and t.ledger_id = p_ledger_id
    )
    and exists (
      select 1 from public.tags g
      where g.id = x.tag_id and g.ledger_id = p_ledger_id
    )
  on conflict do nothing;
  get diagnostics n_transaction_tags = row_count;

  -- 預算
  insert into public.budgets (id, ledger_id, category_id, category_kind, amount, created_at)
  select
    x.id, p_ledger_id, x.category_id, coalesce(x.category_kind, 'expense'::public.category_kind),
    x.amount, coalesce(x.created_at, now())
  from jsonb_to_recordset(v_budgets) as x (
    id uuid,
    category_id uuid,
    category_kind public.category_kind,
    amount numeric,
    created_at timestamptz
  )
  on conflict do nothing;
  get diagnostics n_budgets = row_count;

  return json_build_object(
    'accounts', n_accounts,
    'categories', n_categories,
    'tags', n_tags,
    'recurring_transactions', n_recurring,
    'transactions', n_transactions,
    'transaction_tags', n_transaction_tags,
    'budgets', n_budgets
  );
end;
$$;

revoke all on function public.restore_backup(uuid, jsonb) from public, anon;
grant execute on function public.restore_backup(uuid, jsonb) to authenticated;
