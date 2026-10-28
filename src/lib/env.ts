/**
 * EXPO_PUBLIC_ 開頭的變數會在打包時直接寫進 App，只能放可以公開的值。
 * 本機開發寫在 .env（參考 .env.example）；EAS Build 則要設定在 EAS 環境變數。
 * https://docs.expo.dev/guides/environment-variables/
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
};

export const isSupabaseConfigured = env.supabaseUrl !== '' && env.supabasePublishableKey !== '';
