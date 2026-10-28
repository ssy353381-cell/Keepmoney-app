# KeepMoney 記帳 App

用 Expo（React Native）開發的記帳 App，資料存在 Supabase 雲端，之後規劃上架 Apple App Store。

| 項目     | 選擇                                                 |
| -------- | ---------------------------------------------------- |
| 框架     | Expo SDK 57、React Native 0.86、React 19             |
| 導覽     | Expo Router（檔案即路由，`src/app/`）                |
| 語言     | TypeScript（strict）                                 |
| 後端     | Supabase（Postgres + Auth），`@supabase/supabase-js` |
| 資料存取 | TanStack Query（快取、重新整理）                     |
| 打包上架 | EAS Build / EAS Submit                               |
| 程式品質 | ESLint、Prettier、Jest 單元測試、GitHub Actions CI   |

> 為什麼是 SDK 57 而不是最新的 58？App Store 上的 Expo Go 目前只支援 SDK 57，用 57 可以直接拿手機掃 QR code 開發，不需要 Mac 或 Apple 開發者帳號。之後升級方式見[升級 SDK](#升級-sdk)。

## 功能

| 分頁／畫面 | 內容                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| 登入／註冊 | Email + 密碼；註冊後自動建立「我的帳本」、現金帳戶與預設分類                     |
| 明細       | 依月份切換、依日期分組；本月收入／支出／結餘；右下角＋記一筆，點一筆可編輯或刪除 |
| 記一筆     | 支出／收入／轉帳、金額、分類（含子分類）、帳戶、日期、備註、標籤                 |
| 統計       | 本月收支、預算進度（80% 提醒、超支警示）、支出／收入分類排行（子分類併入父分類） |
| 帳戶       | 各帳戶餘額與淨資產；新增、編輯、封存、刪除帳戶                                   |
| 設定       | 帳號資訊、連線測試、登出                                                         |

## 開發環境需求

- **Node.js 22**（版本寫在 `.nvmrc`，用 nvm 的話執行 `nvm use`）
- **手機安裝 Expo Go**：[iOS](https://apps.apple.com/app/expo-go/id982107779)／[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
- 選用：Mac + Xcode（iOS 模擬器）、Android Studio（Android 模擬器）
- 建議 VS Code，打開專案時安裝推薦的擴充套件（Expo Tools、ESLint、Prettier）

## 快速開始

```bash
git clone https://github.com/ssy353381-cell/Keepmoney-app.git
cd Keepmoney-app
npm install
cp .env.example .env   # 填入 Supabase 的 URL 與 publishable key
npm start              # 手機打開 Expo Go 掃 QR code
```

手機和電腦要在同一個 Wi-Fi；連不上時改用 `npx expo start --tunnel`。

> 修改 `.env` 之後要用 `npx expo start --clear` 清除快取，否則 App 裡還是舊的值。

## 常用指令

| 指令                                              | 用途                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm start`                                       | 啟動開發伺服器                                                                     |
| `npm run ios` / `npm run android` / `npm run web` | 直接開模擬器／瀏覽器                                                               |
| `npm run lint`                                    | ESLint 檢查                                                                        |
| `npm run typecheck`                               | TypeScript 型別檢查                                                                |
| `npm run format`                                  | Prettier 自動排版                                                                  |
| `npm test`                                        | Jest 單元測試（金額、日期、統計、錯誤訊息）                                        |
| `npm run check`                                   | lint + 型別 + 排版 + 單元測試一次跑完（CI 也跑這些）                               |
| `npx expo install <套件>`                         | 安裝套件（會自動挑選與 SDK 相容的版本，**不要用 `npm install` 裝 Expo／RN 套件**） |
| `npx expo-doctor`                                 | 檢查套件版本與設定問題                                                             |

## 專案結構

```
src/
  app/                       # 畫面（Expo Router：每個檔案就是一個路由）
    _layout.tsx              #   根 layout：登入狀態決定能進哪些畫面
    sign-in.tsx / sign-up.tsx#   登入、註冊（未登入才看得到）
    (app)/                   #   登入後的畫面
      _layout.tsx            #     載入帳本，並註冊彈出視窗
      (tabs)/                #     底部分頁：明細、統計、帳戶、設定
      transaction/[id].tsx   #     記一筆／編輯記錄（id 為 new 代表新增）
      account/[id].tsx       #     新增／編輯帳戶
      budgets.tsx            #     每月預算設定
  api/                       # 讀寫 Supabase 的 hooks（TanStack Query）
  providers/                 # 登入狀態、目前帳本
  components/                # 共用元件；ui/ 是按鈕、輸入框等基本元件
  constants/theme.ts         # 顏色、間距、字型
  lib/                       # 金額、日期、統計、錯誤訊息等純函式（有單元測試）
  types/database.ts          # 由 Supabase 產生的資料庫型別（不要手改）
supabase/migrations/         # 資料庫結構變更（SQL）
supabase/tests/rls_check.sql # 權限與資料完整性檢查
assets/                      # 圖示、啟動畫面（目前是 Expo 預設圖，上架前要換）
app.json                     # App 設定：名稱、Bundle ID、圖示…
eas.json                     # EAS Build / Submit 設定
```

## Supabase 設定

後端專案 `keepmoney`（東京 ap-northeast-1，免費方案）已建立，`.env.example` 裡就是它的 URL 與 publishable key：

1. `cp .env.example .env`
2. 重新啟動 `npm start`，註冊一個帳號就能開始記帳。

**Email 驗證**：Supabase 預設要求新帳號先點確認信。點信中連結後，手機瀏覽器顯示「無法開啟網頁」是正常的（還沒有設定網站網址），帳號已完成驗證，回到 App 登入即可。另外 Supabase 內建的寄信服務每小時只能寄少量信件，開發測試時可以到 Dashboard → Authentication → Sign In / Providers → Email 關閉「Confirm email」，上架前再打開並設定自己的寄信服務（SMTP）。

安全規則：

- App 裡只能放 **publishable key**。`sb_secret_...`／`service_role` key 有完整權限，絕對不能出現在 App 或 git 裡。
- 每一張資料表都要**開啟 RLS（Row Level Security）**並寫好 policy。publishable key 是公開的，資料安全完全靠 RLS。
- 免費方案的專案**閒置 7 天會被暫停**，到 Dashboard 按 Restore 即可恢復，資料不會消失。

## 資料庫結構

所有記帳資料都掛在「帳本」底下，權限一律由「帳本成員」決定。目前每人一本；之後要做家人／伴侶共用，只需要開放新增成員的流程，不必搬資料。

| 資料表                     | 用途                                | 重點                                                  |
| -------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `profiles`                 | 使用者資料（顯示名稱）              | 註冊時自動建立                                        |
| `ledgers`                  | 帳本                                | 註冊時自動建立「我的帳本」；幣別欄位預設 `TWD`        |
| `ledger_members`           | 帳本成員與角色                      | `owner`／`editor` 可寫，`viewer` 只能看               |
| `accounts`                 | 帳戶：現金、銀行、信用卡、電子支付… | 有期初餘額；不用的帳戶用 `is_archived` 封存           |
| `categories`               | 收支分類                            | 可有一層子分類；新帳本自動建立 16 個預設分類          |
| `transactions`             | 交易                                | `type`：`expense`／`income`／`transfer`；金額一律正數 |
| `tags`、`transaction_tags` | 標籤（一筆交易可多個）              | 例如「旅行」「公司報帳」                              |
| `budgets`                  | 每月預算                            | `category_id` 為空＝每月總預算；只能設在支出分類      |
| `recurring_transactions`   | 定期收支範本                        | 每日／週／月／年 × 間隔；`next_occurs_on` 為下次日期  |
| `account_balances`（view） | 各帳戶目前餘額                      | 期初 + 收入 + 轉入 − 支出 − 轉出                      |

資料庫層就會擋下的錯誤（App 不必重複檢查也不會寫壞資料）：

- 引用別本帳本的帳戶／分類／標籤
- 支出用了收入分類（或反過來）、轉帳卻填了分類、轉帳轉給同一個帳戶
- 金額 ≤ 0、預算設在收入分類、同一分類重複設預算
- 有交易的帳戶或分類不能直接刪除（請封存）

其他規則：

- `occurred_on`（交易日期）沒有預設值：資料庫是 UTC，日期由 App 依使用者當地時間填入。
- 刪除使用者時，會一併刪除他單獨擁有的帳本與其中所有資料（App Store 要求提供「刪除帳號」）。
- 定期收支目前只有資料表，設定畫面與自動產生交易之後再做。

### 修改資料表的流程

1. 在 `supabase/migrations/` 新增 `<時間戳>_<說明>.sql`（不要改已經套用過的檔案）
2. 套用到 Supabase（`npx supabase db push`，或在 Dashboard 的 SQL Editor 執行）
3. 更新 TypeScript 型別：先 `npx supabase login`，再執行 `npm run db:types`（輸出到 `src/types/database.ts`）

## 上架 App Store 路線圖

`app.json` 已經設好 Bundle ID `com.ssy353381.keepmoney`（第一次送審後就不能改）與加密出口宣告（`usesNonExemptEncryption: false`）；`eas.json` 已經有 development／preview／production 三種 build profile。剩下的步驟：

- [ ] 註冊 [Apple Developer Program](https://developer.apple.com/programs/)（US$99／年）
- [ ] 註冊 [Expo 帳號](https://expo.dev/signup)，執行 `npx eas-cli@latest login`、`npx eas-cli@latest init`（會把 projectId 寫進 `app.json`）
- [ ] 在 EAS 設定環境變數 `EXPO_PUBLIC_SUPABASE_URL`、`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（preview／production 環境）。`.env` 不會進 git，EAS Build 也讀不到，雲端打包要靠這一步
- [ ] 換掉 App 圖示與啟動畫面（`assets/` 裡目前是 Expo 範本圖）
- [ ] 準備隱私權政策網址；在 App Store Connect 填寫「App 隱私」問卷（會用到 Supabase 存的 email、記帳資料）
- [ ] 有帳號註冊功能的話，Apple 規定 App 內必須提供「刪除帳號」
- [ ] `npx eas-cli@latest build --platform ios --profile production`
- [ ] `npx eas-cli@latest submit --platform ios` → 先上 TestFlight 測試
- [ ] 準備 iPhone 截圖（目前 `supportsTablet: false`，不需要 iPad 截圖）並送審

## 升級 SDK

等 Expo Go 支援 SDK 58，或決定改用 development build 時：

```bash
npx expo install expo@^58.0.0 --fix
npx expo-doctor
```

升級前先看 [Expo changelog](https://expo.dev/changelog) 的破壞性變更。
