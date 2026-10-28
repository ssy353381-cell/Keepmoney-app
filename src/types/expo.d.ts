// expo-env.d.ts 只在 `expo start` 時才會產生（且被 gitignore），
// 這裡明確引用 Expo 的型別，讓 CI 上的 `tsc` 也認得 *.css 等匯入。
/// <reference types="expo/types" />
