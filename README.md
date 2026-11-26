# KeepMoney 記帳 App

用 Expo（React Native）開發的記帳 App，資料存在 Supabase 雲端，之後規劃上架 Apple App Store。

| 項目     | 選擇                                                 |
| -------- | ---------------------------------------------------- |
| 框架     | Expo SDK 58、React Native 0.88、React 19.3           |
| 導覽     | Expo Router（檔案即路由，`src/app/`）                |
| 語言     | TypeScript（strict）                                 |
| 後端     | Supabase（Postgres + Auth），`@supabase/supabase-js` |
| 資料存取 | TanStack Query（快取、重新整理）                     |
| 打包上架 | EAS Build / EAS Submit                               |
| 程式品質 | ESLint、Prettier、Jest 單元測試、GitHub Actions CI   |

> 手機上的 Expo Go 只支援最新一版 SDK，而且會自動更新。Expo Go 更新到新 SDK 後，專案也要跟著升級才能用 Expo Go 開發，做法見[升級 SDK](#升級-sdk)。

## 功能

| 分頁／畫面       | 內容                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 登入／註冊       | Email + 密碼；註冊後自動建立「我的帳本」、現金帳戶與預設分類                                                                                                                                                                               |
| 樹（首頁）       | 一天＝一片葉，一個月＝一棵樹，一年＝一座森林（上方切換月／年）；葉子顏色看當天支出相對每日參考額（嫩綠→黃→橘→紅），葉上每條紋路是一筆收支；點葉子看那一天                                                                                  |
| 某一天           | 大片葉子、當天收支、當天所有交易（含轉帳）；可直接「在這天記一筆」                                                                                                                                                                         |
| 明細             | 依月份切換、依日期分組；本月收入／支出／結餘；右下角＋記一筆，點一筆可編輯或刪除                                                                                                                                                           |
| 快速記帳         | 打一句話（例如「昨天午餐 120」）就能記帳，也可以點 iPhone 鍵盤上的麥克風用說的；即時預覽金額、分類、日期，可修改後儲存。首頁右下角的「記一筆」會開啟，也可用深層連結 `keepmoney://quick` 直接打開                                          |
| 待確認           | 快速記帳時分類猜不到（退回「其他」）、或由捷徑記下的帳會標為「待確認」：樹葉上的紋路畫成虛線，明細頁有「待確認」分頁，首頁會提示筆數；開啟那一筆在完整表單按儲存就算確認                                                                   |
| 拍照記帳         | 掃描電子發票證明聯的兩個 QR code，自動帶入金額、日期、品名備註與發票號碼（同一張發票只能記一次）；每筆記錄可附一張收據照片（拍照或從相簿選，縮到長邊 1600px），存在私有的 Supabase Storage。入口：快速記帳畫面的「📷 掃發票」「🧾 拍收據」 |
| 記一筆           | 支出／收入／轉帳、金額、分類（含子分類）、帳戶、日期（今天／昨天或月曆）、備註、標籤                                                                                                                                                       |
| 統計             | 本月收支、預算進度（80% 提醒、超支警示）、支出／收入分類排行（子分類併入父分類）                                                                                                                                                           |
| 帳戶             | 各帳戶餘額與淨資產；新增、編輯、封存、刪除帳戶                                                                                                                                                                                             |
| 手機條碼載具匯入 | 設定 → 手機條碼載具 → 匯入發票明細：選財政部平台匯出的載具消費明細檔，預覽解析結果（可取消個別發票、選記到哪個帳戶），一次記下多筆；已記過的發票自動略過，匯入的帳標成待確認                                                               |
| 設定             | 帳號資訊、不開 App 記帳（iPhone 捷徑＋Siri）、備份與還原（JSON／CSV 匯出、從 JSON 還原）、連線測試、登出、刪除帳號                                                                                                                         |

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
    dev-preview.tsx          #   開發預覽：假資料的葉子、樹、森林（只有開發模式、不需登入）
    (app)/                   #   登入後的畫面
      _layout.tsx            #     載入帳本，並註冊彈出視窗
      (tabs)/                #     底部分頁：樹（index）、明細（transactions）、統計、帳戶、設定
      day/[date].tsx         #     某一天：大葉子與當天交易（彈出視窗）
      quick.tsx              #     快速記帳：一句話＋預覽（彈出視窗，`keepmoney://quick`）
      scan.tsx               #     掃描電子發票 QR code（全螢幕彈出視窗）
      quick-setup.tsx        #     不開 App 記帳：產生捷徑金鑰、設定 iPhone 捷徑步驟（彈出視窗）
      transaction/[id].tsx   #     記一筆／編輯記錄（id 為 new 代表新增）
      account/[id].tsx       #     新增／編輯帳戶
      budgets.tsx            #     每月預算設定
      carrier-import.tsx     #     匯入手機條碼載具發票明細：選檔、預覽、確認後批次匯入（彈出視窗）
      backup.tsx             #     備份與還原：匯出 JSON／CSV、選備份檔預覽並還原（彈出視窗）
  api/                       # 讀寫 Supabase 的 hooks（TanStack Query；carrier-import.ts 是載具明細的選檔與批次匯入）
  providers/                 # 登入狀態、目前帳本
  components/                # 共用元件；ui/ 是按鈕、輸入框等基本元件
    receipt-photo-field.tsx  #   收據照片欄位：拍照、選照片、縮圖、放大、移除
    forest/                  #   葉子、樹、森林的 SVG 元件（leaf-svg、tree-svg、forest-svg）
  constants/theme.ts         # 顏色、間距、字型
  lib/                       # 金額、日期、統計、錯誤訊息等純函式（有單元測試）
                             #   quick-parse / quick-entry：一句話解析與分類、帳戶對應
                             #   relative-time：金鑰「上次使用」的顯示文字；env 的 quickEntryUrl 是捷徑網址
                             #   invoice-qr / invoice-scan：電子發票 QR 解析、左右 QR 掃描狀態
                             #   receipt-path / receipt-image / receipt-photo：照片路徑、縮圖規則、拍照與壓縮
                             #   carrier-import / carrier-plan：載具明細檔解析（M|／D| 與 CSV）、分類猜測、匯入規劃、亂碼偵測
                             #   backup / backup-reminder / restore-result：備份檔格式與驗證、還原計畫、備份提醒、還原結果文字
                             #   daily-summary / leaf-color / leaf / tree / forest：樹葉的資料與幾何
  types/database.ts          # 由 Supabase 產生的資料庫型別（不要手改）
supabase/migrations/         # 資料庫結構變更（SQL）
supabase/functions/quick-entry/ # 快速記帳 Edge Function（捷徑呼叫的入口）
supabase/tests/rls_check.sql # 權限與資料完整性檢查
assets/                      # 圖示、啟動畫面（目前是 Expo 預設圖，上架前要換）
app.json                     # App 設定：名稱、Bundle ID、圖示…
eas.json                     # EAS Build / Submit 設定
```

## iPhone 捷徑：不開 App 記帳

在 iPhone 的「捷徑」App 建一個捷徑，之後說「嘿 Siri，記一筆」或按動作按鈕，說出「午餐 120」就會記下來。記下的帳會標成「待確認」，回到 App 首頁就會看到提醒。

1. 在 App：設定 → 快速記帳 → 設定 iPhone 捷徑，產生金鑰（只會顯示一次，請馬上複製；一個帳號最多 5 把，遺失了就刪掉重產）。
2. 打開「捷徑」App，點右上角「＋」新增捷徑，名稱取「記一筆」（Siri 就會聽這個名字）。
3. 加入動作「聽寫文字」（語言選「中文（台灣）」）。想用打字的話改加「要求輸入」。
4. 加入動作「取得 URL 的內容」：
   - 網址：`https://<專案>.supabase.co/functions/v1/quick-entry`
   - 方法：**POST**
   - 標頭：`x-keepmoney-token` ＝ `<在 App 設定頁產生的金鑰>`
   - 要求本文：**JSON**，欄位 `text`＝「聽寫的文字」，欄位 `date`＝「目前日期」（日期格式選「自訂」`yyyy-MM-dd`）
5. 加入動作「顯示通知」，內容選「URL 的內容」。
6. 說「嘿 Siri，記一筆」試試看。也可以到「設定 → 動作按鈕 → 捷徑」選它、「設定 → 輔助使用 → 觸控 → 背面輕點」設定輕點兩下執行，或加到控制中心、主畫面、鎖定畫面小工具。

金鑰等同記帳密碼，任何拿到的人都能幫你記帳，不要分享或貼到公開的地方。

### Edge Function

- 位置：`supabase/functions/quick-entry/`；請求為 `POST`，JSON `{ "text": "午餐 120", "date": "YYYY-MM-DD" }`，回傳純文字（例如「✅ 已記下：午餐 $120（飲食・現金）」）。
- 解析器與 App 共用：要修改時先改 `src/lib/quick-parse.ts`，再執行 `npm run sync:functions` 同步到 Edge Function。
- 部署：`npx supabase functions deploy quick-entry --no-verify-jwt`（身分由金鑰決定，所以要關掉 JWT 驗證），或用 Supabase MCP 部署。

## 手機條碼載具匯入

到設定 → 手機條碼載具 → 匯入發票明細，選財政部電子發票整合服務平台匯出的載具消費明細檔。畫面會先顯示解析結果（可匯入、已記過、作廢、無法讀取的筆數與總金額），確認後才寫入；每 500 筆一批，中途失敗時已寫入的不會回滾，重新選同一個檔案即可（已記過的發票會自動略過）。匯入的帳標成「待確認」、來源為 `import`，發票號碼與掃描 QR code 共用同一個不重複限制。

### 注意事項

- 開發時拿不到官方範本，檔案格式沒有確認過。解析器依「表頭名稱」判斷欄位，支援「M|／D|」格式與一般 CSV；看不懂的行會列出行號與原因，不會默默匯入錯的資料。
- 檔案必須是 UTF-8；Big5 等編碼會被偵測為亂碼並提示另存成「CSV UTF-8」。檔案上限 5MB。
- 若遇到看不懂的檔案，請提供範例（去掉個資）以便調整解析器。

### 自動同步（未實作）

目前只能手動匯出再匯入。要自動同步載具發票，需要向財政部財政資訊中心申請 API AppID，須經審核並填寫資安自我檢核。申請通過後再以 Edge Function ＋排程實作，手機條碼驗證碼存放在 Supabase Vault。

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

| 資料表                     | 用途                                | 重點                                                                                                                                                                                                                                                                         |
| -------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                 | 使用者資料（顯示名稱）              | 註冊時自動建立                                                                                                                                                                                                                                                               |
| `ledgers`                  | 帳本                                | 註冊時自動建立「我的帳本」；幣別欄位預設 `TWD`                                                                                                                                                                                                                               |
| `ledger_members`           | 帳本成員與角色                      | `owner`／`editor` 可寫，`viewer` 只能看                                                                                                                                                                                                                                      |
| `accounts`                 | 帳戶：現金、銀行、信用卡、電子支付… | 有期初餘額；不用的帳戶用 `is_archived` 封存                                                                                                                                                                                                                                  |
| `categories`               | 收支分類                            | 可有一層子分類；新帳本自動建立 16 個預設分類                                                                                                                                                                                                                                 |
| `transactions`             | 交易                                | `type`：`expense`／`income`／`transfer`；金額一律正數；`needs_review`＝待確認；`source`＝來源（`app`／`quick`／`shortcut`／`invoice_qr`／`import`）；`invoice_number`＝電子發票號碼（2 碼英文＋8 碼數字，同帳本內唯一）；`receipt_path`＝收據照片在 `receipts` bucket 的路徑 |
| `tags`、`transaction_tags` | 標籤（一筆交易可多個）              | 例如「旅行」「公司報帳」                                                                                                                                                                                                                                                     |
| `budgets`                  | 每月預算                            | `category_id` 為空＝每月總預算；只能設在支出分類                                                                                                                                                                                                                             |
| `recurring_transactions`   | 定期收支範本                        | 每日／週／月／年 × 間隔；`next_occurs_on` 為下次日期                                                                                                                                                                                                                         |
| `quick_entry_tokens`       | 捷徑金鑰（iPhone 捷徑記帳用）       | 只存 sha256 雜湊，明文只在建立時回傳一次；每人最多 5 把                                                                                                                                                                                                                      |
| `account_balances`（view） | 各帳戶目前餘額                      | 期初 + 收入 + 轉入 − 支出 − 轉出                                                                                                                                                                                                                                             |

**Storage bucket `receipts`**（私有、單檔 5 MB、只收 JPEG／PNG）：路徑一律是 `<ledger_id>/<transaction_id>/<檔名>.jpg`，RLS 以第一層資料夾（帳本 id）判斷：帳本成員可讀，擁有者與編輯者可寫。App 用 signed URL（1 小時有效）顯示照片。資料庫無法刪除 storage 檔案，所以由 App 負責：刪除記錄、換掉或移除照片時先刪檔案；刪除帳號前先清空 `<ledger_id>/` 底下所有照片（`src/api/receipts.ts`）。

資料庫層就會擋下的錯誤（App 不必重複檢查也不會寫壞資料）：

- 引用別本帳本的帳戶／分類／標籤
- 支出用了收入分類（或反過來）、轉帳卻填了分類、轉帳轉給同一個帳戶
- 金額 ≤ 0、預算設在收入分類、同一分類重複設預算
- 有交易的帳戶或分類不能直接刪除（請封存）

其他規則：

- `occurred_on`（交易日期）沒有預設值：資料庫是 UTC，日期由 App 依使用者當地時間填入。
- 刪除使用者時，會一併刪除他單獨擁有的帳本與其中所有資料。App 的「設定 → 刪除帳號」呼叫資料庫函式 `delete_my_account()`，只能刪除呼叫者自己（App Store 要求提供刪除帳號）。
- `quick_add()`：給 iPhone 捷徑用的資料庫函式，anon 可呼叫，身分完全由捷徑金鑰決定（沒有金鑰就什麼都寫不進去）；寫入的交易一律是 `needs_review = true`、`source = 'shortcut'`，分類名稱對不到時退回「其他」。金鑰由登入使用者呼叫 `create_quick_entry_token()` 建立。
- `restore_backup(p_ledger_id, p_payload)`：從備份還原用的資料庫函式，`security invoker`（用呼叫者身分寫入，RLS 照常生效，要有該帳本的寫入權限），整個函式是單一交易（任何一筆違反約束就整批取消、什麼都不寫入）；每個 insert 都 `on conflict do nothing`，衝突的略過，所以同一份備份重複還原不會重複寫入，回傳實際寫入的筆數；一律寫進 `p_ledger_id`、不寫 `created_by`；收據照片不在備份裡（`receipt_path` 一律為空）。App 的備份檔（JSON）由 `src/lib/backup.ts` 產生與驗證、`src/api/backup.ts` 匯出與還原；備份檔不含使用者 uuid（`created_by`）。
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
- [x] 有帳號註冊功能的話，Apple 規定 App 內必須提供「刪除帳號」（設定頁已提供）
- [ ] `npx eas-cli@latest build --platform ios --profile production`
- [ ] `npx eas-cli@latest submit --platform ios` → 先上 TestFlight 測試
- [ ] 準備 iPhone 截圖（目前 `supportsTablet: false`，不需要 iPad 截圖）並送審

## 升級 SDK

手機的 Expo Go 顯示「Project is incompatible with this version of Expo Go」時，代表 Expo Go 已經更新到新 SDK，專案要跟著升級（以下用 SDK 59 舉例）：

```bash
npm install expo@^59.0.0
npx expo install --fix
npx expo-doctor
npm run check
```

1. 升級前先看 [Expo changelog](https://expo.dev/changelog) 與 Expo Router 的遷移指南，處理破壞性變更。
2. 不要用 `--force` 或 `--legacy-peer-deps` 硬裝；遇到套件版本衝突時先找原因（SDK 58 升級時就是把有衝突的原生日期選擇器換成自製月曆）。
3. 升級後用 `npx expo start --clear` 清除快取再測試。
