import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { fitWithin, RECEIPT_JPEG_QUALITY } from '@/lib/receipt-image';

export type PickResult =
  { status: 'ok'; uri: string } | { status: 'canceled' } | { status: 'denied'; message: string };

/** 縮到長邊最多 1600px、存成 JPEG 品質 0.7，回傳本機 uri */
export async function compressReceipt(uri: string): Promise<string> {
  const loaded = await ImageManipulator.manipulate(uri).renderAsync();
  const target = fitWithin(loaded.width, loaded.height);
  const resized = target
    ? await ImageManipulator.manipulate(loaded).resize(target).renderAsync()
    : loaded;
  const saved = await resized.saveAsync({
    format: SaveFormat.JPEG,
    compress: RECEIPT_JPEG_QUALITY,
  });
  return saved.uri;
}

/** 拍照或從相簿選一張收據：先請求權限，選好後壓縮 */
export async function pickReceiptPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      status: 'denied',
      message:
        source === 'camera'
          ? '需要相機權限才能拍收據，請到系統設定允許 KeepMoney 使用相機'
          : '需要相簿權限才能選照片，請到系統設定允許 KeepMoney 存取照片',
    };
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) {
    return { status: 'canceled' };
  }
  return { status: 'ok', uri: await compressReceipt(asset.uri) };
}
