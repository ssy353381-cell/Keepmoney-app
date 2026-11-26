import {
  isLeftInvoiceQr,
  isRightInvoiceQr,
  parseInvoiceQr,
  type InvoiceQr,
} from '@/lib/invoice-qr';

/** 一次掃描的狀態：發票有左右兩個 QR，可能先掃到任一個 */
export type ScanState = { left: string | null; right: string | null; leftAt: number | null };

export function initialScanState(): ScanState {
  return { left: null, right: null, leftAt: null };
}

/** 收到一個 QR 的內容。非發票的 QR 忽略；同樣內容重複掃到不改變狀態。 */
export function acceptScan(state: ScanState, text: string, now: number): ScanState {
  if (isLeftInvoiceQr(text)) {
    if (state.left === text) return state;
    // 換了一張發票：右方 QR 也重新來過；先掃到右方再掃到左方時則保留右方
    return { left: text, right: state.left === null ? state.right : null, leftAt: now };
  }
  if (isRightInvoiceQr(text)) {
    return state.right === text ? state : { ...state, right: text };
  }
  return state;
}

/**
 * 有左方 QR 且（已有右方，或左方出現超過 waitMs）就解析；
 * 解析失敗為 'invalid'，還在等右方為 'waiting'。
 */
export function scanResult(
  state: ScanState,
  now: number,
  waitMs = 1200,
): InvoiceQr | 'waiting' | 'invalid' {
  if (state.left === null) return 'waiting';
  const waited = state.leftAt !== null && now - state.leftAt > waitMs;
  if (state.right === null && !waited) return 'waiting';
  return parseInvoiceQr(state.left, state.right) ?? 'invalid';
}

/** 路由參數裡的發票號碼：只接受 2 個大寫英文字母＋8 個數字 */
export function readInvoiceNumber(value: string | undefined): string | null {
  return value && /^[A-Z]{2}\d{8}$/.test(value) ? value : null;
}
