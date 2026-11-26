import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { invoiceNote } from '@/lib/invoice-qr';
import { acceptScan, initialScanState, scanResult } from '@/lib/invoice-scan';

const WAIT_MS = 1200;

/** 掃描電子發票：把證明聯左右兩個 QR code 都放進框內，讀到就帶入記一筆表單 */
export default function ScanScreen() {
  if (Platform.OS === 'web') {
    return (
      <Centered>
        <ThemedText>請在手機上使用掃描功能</ThemedText>
        <Button title="改用手動輸入" variant="secondary" onPress={openManual} />
      </Centered>
    );
  }
  return <NativeScanner />;
}

function openManual() {
  router.replace('/transaction/new');
}

function Centered({ children }: { children: React.ReactNode }) {
  return <ThemedView style={styles.center}>{children}</ThemedView>;
}

function NativeScanner() {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return <ThemedView style={styles.center} />;
  }
  if (!permission.granted) {
    return (
      <Centered>
        <ThemedText type="smallBold">需要使用相機</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.text}>
          掃描電子發票上的 QR code 需要使用相機，影像只會在手機上處理，不會上傳。
        </ThemedText>
        {permission.canAskAgain ? (
          <Button title="允許使用相機" onPress={requestPermission} />
        ) : (
          <>
            <ThemedText themeColor="textSecondary" style={styles.text}>
              相機權限已被關閉，請到系統設定允許 KeepMoney 使用相機。
            </ThemedText>
            <Button title="前往系統設定" onPress={() => Linking.openSettings()} />
          </>
        )}
        <Button title="改用手動輸入" variant="secondary" onPress={openManual} />
      </Centered>
    );
  }
  return <Scanner />;
}

function Scanner() {
  const [state, setState] = useState(initialScanState);
  const [now, setNow] = useState(() => Date.now());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const navigated = useRef(false);

  const result = scanResult(state, now, WAIT_MS);
  const invalid = result === 'invalid';

  // 左方 QR 出現後，等不到右方就在 WAIT_MS 後重新判斷一次
  const leftAt = state.leftAt;
  useEffect(() => {
    if (leftAt === null) {
      return;
    }
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, leftAt + WAIT_MS - Date.now()) + 50,
    );
    return () => clearTimeout(timer);
  }, [leftAt]);

  // 解析成功：帶入記一筆表單
  useEffect(() => {
    if (typeof result !== 'object' || navigated.current) {
      return;
    }
    navigated.current = true;
    router.replace({
      pathname: '/transaction/[id]',
      params: {
        id: 'new',
        type: 'expense',
        amount: String(result.amount),
        date: result.date,
        note: invoiceNote(result),
        invoiceNumber: result.invoiceNumber,
      },
    });
  }, [result]);

  function handleScanned({ data }: { data: string }) {
    const t = Date.now();
    setState((current) => acceptScan(current, data, t));
    setNow(t);
  }

  function retry() {
    setState(initialScanState());
    setNow(Date.now());
  }

  const hint = invalid
    ? '這張發票的 QR code 讀不出來，請改用手動輸入'
    : state.left !== null
      ? '讀取中…'
      : '把發票上的兩個 QR code 都放進框內';

  return (
    <View style={styles.camera}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        // 解析失敗時暫停接收，等使用者按重試
        onBarcodeScanned={invalid ? undefined : handleScanned}
        onMountError={(e) => setCameraError(e.message)}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.hintBox}>
          <ThemedText type="smallBold" style={styles.hintText}>
            {cameraError ?? hint}
          </ThemedText>
        </View>
        <View style={styles.frame} pointerEvents="none" />
        <View style={styles.actions}>
          {invalid && <Button title="重試" onPress={retry} />}
          <Button title="改用手動輸入" variant="secondary" onPress={openManual} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  text: {
    textAlign: 'center',
  },
  camera: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five,
  },
  hintBox: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  hintText: {
    color: '#ffffff',
    textAlign: 'center',
  },
  frame: {
    width: '85%',
    aspectRatio: 1.6,
    borderRadius: Spacing.three,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  actions: {
    width: '100%',
    gap: Spacing.two,
  },
});
