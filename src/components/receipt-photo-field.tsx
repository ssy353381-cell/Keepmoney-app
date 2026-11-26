import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { useReceiptUrl } from '@/api/receipts';
import type { ReceiptChange } from '@/api/transactions';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toErrorMessage } from '@/lib/errors';
import { pickReceiptPhoto } from '@/lib/receipt-photo';

type Props = {
  /** 編輯舊記錄時，資料庫裡原本的照片路徑 */
  existingPath: string | null;
  value: ReceiptChange;
  onChange: (next: ReceiptChange) => void;
  /** 畫面一打開就直接開相機（快速記帳的「拍收據」用） */
  autoOpenCamera?: boolean;
};

/** 收據照片：拍照、從相簿選、縮圖、更換、移除、點擊放大 */
export function ReceiptPhotoField({ existingPath, value, onChange, autoOpenCamera }: Props) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const showingExisting = value.kind === 'keep' && existingPath !== null;
  const remoteUrl = useReceiptUrl(showingExisting ? existingPath : null);
  const imageUri = value.kind === 'new' ? value.uri : showingExisting ? remoteUrl.data : undefined;
  const hasPhoto = value.kind === 'new' || showingExisting;

  async function pick(source: 'camera' | 'library') {
    setBusy(true);
    setMessage(null);
    try {
      const result = await pickReceiptPhoto(source);
      if (result.status === 'ok') {
        onChange({ kind: 'new', uri: result.uri });
      } else if (result.status === 'denied') {
        setMessage(result.message);
      }
    } catch (e) {
      setMessage(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // 只自動開一次；等彈出視窗的轉場結束再開，iOS 在轉場中開相機會失敗
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!autoOpenCamera || autoOpened.current) {
      return;
    }
    autoOpened.current = true;
    const timer = setTimeout(() => void pick('camera'), 600);
    return () => {
      clearTimeout(timer);
      autoOpened.current = false;
    };
    // pick 每次 render 都是新函式，只在掛載時執行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCamera]);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">收據照片（選填）</ThemedText>

      {hasPhoto ? (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="放大檢視收據"
            onPress={() => imageUri && setZoomed(true)}
            style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.thumb} contentFit="cover" />
            ) : remoteUrl.isError ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                讀不到照片
              </ThemedText>
            ) : (
              <ActivityIndicator />
            )}
          </Pressable>
          <View style={styles.actions}>
            <Button
              title="拍照更換"
              variant="secondary"
              onPress={() => pick('camera')}
              disabled={busy}
            />
            <Button
              title="從相簿更換"
              variant="secondary"
              onPress={() => pick('library')}
              disabled={busy}
            />
            <Button
              title="移除照片"
              variant="danger"
              onPress={() => {
                setMessage(null);
                // 新選的還沒存：回到原本的狀態；原本就有的：標記為要移除
                onChange(
                  value.kind === 'new' && existingPath ? { kind: 'keep' } : { kind: 'remove' },
                );
              }}
              disabled={busy}
            />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Button
            title="📷 拍照"
            variant="secondary"
            onPress={() => pick('camera')}
            loading={busy}
            style={styles.flex}
          />
          <Button
            title="🖼️ 從相簿選"
            variant="secondary"
            onPress={() => pick('library')}
            disabled={busy}
            style={styles.flex}
          />
        </View>
      )}

      {value.kind === 'remove' && existingPath && (
        <ThemedText type="small" themeColor="textSecondary">
          儲存後會刪除原本的照片
        </ThemedText>
      )}
      {message && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {message}
        </ThemedText>
      )}

      <Modal
        visible={zoomed}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomed(false)}>
        <Pressable style={styles.overlay} onPress={() => setZoomed(false)}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.full} contentFit="contain" />
          )}
          <ThemedText type="small" style={styles.close}>
            點一下關閉
          </ThemedText>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  flex: {
    flex: 1,
  },
  thumb: {
    width: 120,
    height: 160,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    flex: 1,
    gap: Spacing.two,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: {
    width: '100%',
    height: '90%',
  },
  close: {
    color: '#ffffff',
    paddingVertical: Spacing.two,
  },
});
