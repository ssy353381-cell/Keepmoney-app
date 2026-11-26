-- =====================================================================
-- 拍照記帳：電子發票 QR code 與收據照片
--
-- (a) 掃描電子發票證明聯的 QR code，帶入金額、日期、發票號碼；
--     同一本帳本內，同一張發票只能記一次（invoice_number 唯一）。
-- (b) 為交易附一張收據照片，存在 Supabase Storage 的私有 bucket「receipts」，
--     只有該帳本的成員看得到（讀：所有成員；寫：擁有者與編輯者）。
--
-- 照片路徑格式（一律如此，第一層資料夾是帳本 id，storage policy 靠它判斷權限）：
--     <ledger_id>/<transaction_id>/<檔名>
-- transactions.receipt_path 存的就是這個路徑，資料庫會檢查它必須以
-- 自己的 ledger_id 開頭，避免指向別本帳本的檔案。
--
-- 資料庫無法直接刪除 storage 的檔案（直接 delete storage.objects 只會留下孤兒檔案），
-- 所以 App 要負責：
--   1. 刪除交易（或換掉／移除照片）時，先用 Storage API 刪除對應照片，再刪資料列。
--   2. 刪除帳號前，先用 Storage API 清空該帳本的照片資料夾 <ledger_id>/；
--      刪除帳號只會連帶刪除資料表的資料，不會刪 storage 內的照片。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 交易新增兩個欄位
--   invoice_number：電子發票號碼（英文字母 2 碼＋數字 8 碼，例如 AB12345678）
--   receipt_path：收據照片在 receipts bucket 的路徑
-- 表層級的 grant 與 RLS policy 自動涵蓋新欄位
-- ---------------------------------------------------------------------
alter table public.transactions
  add column invoice_number text,
  add column receipt_path text,
  add constraint transactions_invoice_number_format
    check (invoice_number ~ '^[A-Z]{2}[0-9]{8}$'),
  add constraint transactions_receipt_path_check
    check (
      receipt_path is null
      or (
        char_length(receipt_path) <= 300
        and starts_with(receipt_path, ledger_id::text || '/')
      )
    );

-- 同一本帳本內發票號碼唯一（不同帳本互不影響；沒有發票號碼的交易不受限）
create unique index transactions_invoice_number_key
  on public.transactions (ledger_id, invoice_number)
  where invoice_number is not null;

-- ---------------------------------------------------------------------
-- Storage：私有 bucket「receipts」（單檔上限 5 MB，只收 JPEG／PNG）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- storage.objects 的 RLS：路徑第一層資料夾是帳本 id
-- 用文字比對（r::text），不把路徑轉成 uuid：使用者上傳奇怪路徑時轉型會報錯
-- 只開放給 authenticated，anon 沒有任何 policy，所以什麼都不能碰
-- ---------------------------------------------------------------------
create policy receipts_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select r::text from private.readable_ledger_ids() as r)
  );

create policy receipts_insert_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select r::text from private.writable_ledger_ids() as r)
  );

create policy receipts_update_member on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select r::text from private.writable_ledger_ids() as r)
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select r::text from private.writable_ledger_ids() as r)
  );

create policy receipts_delete_member on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select r::text from private.writable_ledger_ids() as r)
  );
