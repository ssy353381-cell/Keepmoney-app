# KeepMoney 記帳 App

用 Expo（React Native）開發的記帳 App，資料存在 Supabase 雲端，之後規劃上架 Apple App Store。

| 項目     | 選擇                                                      |
| -------- | --------------------------------------------------------- |
| 框架     | Expo SDK 57、React Native 0.86、React 19                  |
| 導覽     | Expo Router（檔案即路由，`src/app/`）                     |
| 語言     | TypeScript（strict）                                      |
| 後端     | Supabase（Postgres + Auth），`@supabase/supabase-js`      |
| 打包上架 | EAS Build / EAS Submit                                    |
| 程式品質 | ESLint（eslint-config-expo）、Prettier、GitHub Actions CI |

> 為什麼是 SDK 57 而不是最新的 58？App Store 上的 Expo Go 目前只支援 SDK 57，用 57 可以直接拿手機掃 QR code 開發，不需要 Mac 或 Apple 開發者帳號。之後升級方式見[升級 SDK](#升級-sdk)。

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

## 常用指令

| 指令                                              | 用途                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm start`                                       | 啟動開發伺服器                                                                     |
| `npm run ios` / `npm run android` / `npm run web` | 直接開模擬器／瀏覽器                                                               |
| `npm run lint`                                    | ESLint 檢查                                                                        |
| `npm run typecheck`                               | TypeScript 型別檢查                                                                |
| `npm run format`                                  | Prettier 自動排版                                                                  |
| `npm run check`                                   | lint + 型別 + 排版一次跑完（CI 也跑這些）                                          |
| `npx expo install <套件>`                         | 安裝套件（會自動挑選與 SDK 相容的版本，**不要用 `npm install` 裝 Expo／RN 套件**） |
| `npx expo-doctor`                                 | 檢查套件版本與設定問題                                                             |

## 專案結構

```
src/
  app/                 # 畫面（Expo Router：每個檔案就是一個路由）
    _layout.tsx        #   根 layout：主題 + 分頁
    index.tsx          #   首頁
    settings.tsx       #   設定（含 Supabase 連線測試）
  components/          # 共用元件（app-tabs 有 native / web 兩個版本）
  constants/theme.ts   # 顏色、間距、字型
  hooks/               # 共用 hooks
  lib/
    env.ts             # 讀取 EXPO_PUBLIC_* 環境變數
    supabase.ts        # Supabase client（登入狀態存在 AsyncStorage）
    check-supabase-connection.ts
assets/                # 圖示、啟動畫面（目前是 Expo 預設圖，上架前要換）
app.json               # App 設定：名稱、Bundle ID、圖示…
eas.json               # EAS Build / Submit 設定
```

## Supabase 設定

1. 到 [Supabase Dashboard](https://supabase.com/dashboard) 建立新專案。區域建議選 **Tokyo（ap-northeast-1）** 或 **Singapore（ap-southeast-1）**，台灣連線延遲較低。
2. 在專案的 **Connect**（或 **Settings → API Keys**）複製 Project URL 與 **publishable key**（`sb_publishable_...`），貼到 `.env`。
3. 重新啟動 `npm start`，到 App 的「設定」頁按「測試連線」。

安全規則：

- App 裡只能放 **publishable key**。`sb_secret_...`／`service_role` key 有完整權限，絕對不能出現在 App 或 git 裡。
- 每一張資料表都要**開啟 RLS（Row Level Security）**並寫好 policy，例如「使用者只能讀寫自己的帳目」。publishable key 是公開的，資料安全完全靠 RLS。

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
