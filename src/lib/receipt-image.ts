/** 收據照片縮圖規則：長邊最多 maxSide，不放大 */
export const RECEIPT_MAX_SIDE = 1600;
export const RECEIPT_JPEG_QUALITY = 0.7;

/**
 * 回傳 image manipulator `resize` 要用的尺寸（只給一邊，另一邊自動依比例）；
 * 長邊沒超過上限（或尺寸不合法）時回傳 null，代表不用縮。
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide = RECEIPT_MAX_SIDE,
): { width: number } | { height: number } | null {
  if (!(width > 0) || !(height > 0) || Math.max(width, height) <= maxSide) {
    return null;
  }
  return width >= height ? { width: maxSide } : { height: maxSide };
}
