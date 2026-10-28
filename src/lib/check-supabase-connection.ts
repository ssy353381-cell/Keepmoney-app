import { env } from '@/lib/env';

export type ConnectionResult = { ok: true } | { ok: false; message: string };

/**
 * 呼叫 Supabase Auth 的公開設定端點，確認 URL 與 publishable key 都正確。
 * 不經過 supabase client，所以還沒設定 .env 時也能安全呼叫。
 */
export async function checkSupabaseConnection(): Promise<ConnectionResult> {
  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.supabasePublishableKey },
    });
    if (response.ok) {
      return { ok: true };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
