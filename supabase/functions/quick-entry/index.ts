// 快速記帳 Edge Function：讓 iPhone「捷徑」／Siri 不開 App 就能記帳。
//
// 流程：捷徑送出一句話（例如「午餐 120」）→ 解析金額、分類、日期
//      → 用 publishable key 呼叫資料庫函式 public.quick_add（身分由「捷徑金鑰」決定）。
//
// 呼叫範例（金鑰可放 x-keepmoney-token 標頭，或放在 body 的 token 欄位）：
//   curl -X POST "https://<專案>.supabase.co/functions/v1/quick-entry" \
//     -H "Content-Type: application/json" \
//     -H "x-keepmoney-token: <你的捷徑金鑰>" \
//     -d '{"text":"午餐 120","date":"2026-11-25"}'
//
// 回應一律是純文字（text/plain），捷徑可直接顯示成通知。
// 不使用 secret／service role key，也不記錄金鑰與記帳內容。

import { parseQuickText } from '../_shared/quick-parse.ts';
import {
  readQuickEntryRequest,
  todayInTimeZone,
  successReply,
  errorReply,
} from '../_shared/quick-entry-api.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

function publishableKey(): string {
  let fromKeys: unknown;
  try {
    fromKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}')['default'];
  } catch {
    fromKeys = undefined;
  }
  return (typeof fromKeys === 'string' && fromKeys) || Deno.env.get('SUPABASE_ANON_KEY') || '';
}

function reply(status: number, message: string): Response {
  console.log(`quick-entry status=${status}`);
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return reply(405, '只接受 POST 請求');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply(400, '請求內容不是有效的 JSON');
  }

  const parsedRequest = readQuickEntryRequest(body, request.headers.get('x-keepmoney-token'));
  if (!parsedRequest.ok) {
    return reply(parsedRequest.status, parsedRequest.message);
  }
  const { text, date, token } = parsedRequest.value;

  const today = date ?? todayInTimeZone(new Date());
  const parsed = parseQuickText(text, today);
  if (parsed.amount === null) {
    return reply(422, '沒聽到金額，請再說一次，例如：午餐 120');
  }

  const key = publishableKey();
  if (!SUPABASE_URL || !key) {
    return reply(500, '伺服器暫時有問題，請稍後再試');
  }

  let response: Response;
  try {
    // 只放 apikey，不放 Authorization: Bearer（publishable key 不是 JWT，放了會被拒）
    response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/quick_add`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_token: token,
        p_type: parsed.type,
        p_amount: parsed.amount,
        p_occurred_on: parsed.occurredOn,
        p_note: parsed.note === '' ? null : parsed.note,
        p_category_name: parsed.categoryName,
      }),
    });
  } catch {
    const failure = errorReply(null, 0);
    return reply(failure.status, failure.message);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || typeof payload !== 'object' || payload === null) {
    const failure = errorReply(
      payload && typeof payload === 'object'
        ? (payload as { code?: string; message?: string })
        : null,
      response.status,
    );
    return reply(failure.status, failure.message);
  }

  const row = payload as {
    type?: 'expense' | 'income';
    amount?: number | string;
    occurred_on?: string;
    category_name?: string;
    account_name?: string;
  };

  return reply(
    200,
    successReply({
      type: row.type === 'income' ? 'income' : 'expense',
      amount: Number(row.amount ?? parsed.amount),
      note: parsed.note,
      categoryName: row.category_name ?? parsed.categoryName ?? '其他',
      accountName: row.account_name ?? '',
      occurredOn: row.occurred_on ?? parsed.occurredOn,
      today,
    }),
  );
});
