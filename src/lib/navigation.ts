import { router } from 'expo-router';

/** 關閉彈出視窗；如果是直接從連結打開（沒有上一頁），就回到首頁 */
export function closeModal() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}
