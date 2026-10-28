/** Supabase Auth 的錯誤代碼 → 中文訊息 */
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email 或密碼錯誤',
  email_not_confirmed: '這個 Email 還沒完成驗證，請先到信箱點擊確認連結',
  user_already_exists: '這個 Email 已經註冊過了，請直接登入',
  email_exists: '這個 Email 已經註冊過了，請直接登入',
  weak_password: '密碼強度不足，請至少輸入 6 個字元',
  email_address_invalid: 'Email 格式不正確',
  over_email_send_rate_limit: '寄信次數太多，請稍後再試',
  over_request_rate_limit: '操作太頻繁，請稍後再試',
  signup_disabled: '目前暫停開放註冊',
  validation_failed: '輸入的資料格式不正確',
  session_expired: '登入已過期，請重新登入',
  session_not_found: '登入已過期，請重新登入',
  refresh_token_not_found: '登入已過期，請重新登入',
  user_banned: '這個帳號已被停用',
};

/** Postgres／PostgREST 的錯誤代碼 → 中文訊息 */
const DATABASE_MESSAGES: Record<string, string> = {
  '23505': '已經有相同的資料了（名稱重複或已設定過）',
  '23514': '資料格式不正確，請檢查輸入內容',
  '42501': '沒有權限進行這個操作',
  PGRST301: '登入已過期，請重新登入',
  PGRST303: '登入已過期，請重新登入',
};

function isNetworkError(message: string): boolean {
  return /network request failed|failed to fetch|load failed|networkerror/i.test(message);
}

/** 把 Supabase 或網路錯誤轉成可以直接顯示給使用者的中文訊息 */
export function toErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return typeof error === 'string' ? error : '發生未知的錯誤，請稍後再試';
  }

  const { code, message } = error as { code?: unknown; message?: unknown };
  const text = typeof message === 'string' ? message : '';

  if (isNetworkError(text)) {
    return '無法連線，請檢查網路後再試一次';
  }

  if (typeof code === 'string') {
    if (code === '23503') {
      // 刪除時被其他資料引用，或新增時引用的資料已不存在
      return text.startsWith('update or delete')
        ? '這筆資料還有交易在使用，無法刪除（可以改用封存）'
        : '選擇的帳戶或分類已不存在，請重新選擇';
    }
    const known = AUTH_MESSAGES[code] ?? DATABASE_MESSAGES[code];
    if (known) {
      return known;
    }
  }

  return text || '發生未知的錯誤，請稍後再試';
}
