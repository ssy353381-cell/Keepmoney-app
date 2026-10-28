@AGENTS.md

## KeepMoney 專案規則

- 回覆使用者、App 內的 UI 文字、程式註解都用**繁體中文**。
- 固定使用 **Expo SDK 57**（為了能用 Expo Go 開發），使用者沒要求就不要升級 SDK 或加入需要 development build 的原生套件；真的需要時先說明取捨。
- 用 `npx expo install` 裝套件。如果環境連不到 `api.expo.dev`，改用 `EXPO_OFFLINE=1 npx expo install <套件>`，版本會取自 `node_modules/expo/bundledNativeModules.json`。
- Supabase：client 在 `src/lib/supabase.ts`，環境變數集中在 `src/lib/env.ts`。App 只能使用 publishable key；新增資料表一定要開 RLS 並寫 policy。
- 資料表結構變更一律新增 `supabase/migrations/<時間戳>_<說明>.sql`（不改已套用的檔案），套用後重新產生 `src/types/database.ts`（不要手改）。資料表說明見 README「資料庫結構」。
- 資料讀寫放在 `src/api/`（TanStack Query hooks），寫入後讓 `ledgerKeys.all(ledgerId)` 失效以重新整理畫面；不要在畫面元件裡直接呼叫 supabase。
- 金額、日期、統計等邏輯寫成 `src/lib/` 的純函式並加上 Jest 測試；日期一律用 `src/lib/date.ts`（當地時間，不要用 `toISOString`）。
- 完成任何修改前執行 `npm run check`（lint + typecheck + prettier + jest）。
