-- =====================================================================
-- 刪除自己的帳號（App Store 要求 App 內提供刪除帳號）
-- 只會刪除呼叫者本人；刪除後由 on_auth_user_deleted 觸發器一併刪除
-- 他單獨擁有的帳本與其中所有資料。
-- =====================================================================
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception '需要登入才能刪除帳號' using errcode = '42501';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
