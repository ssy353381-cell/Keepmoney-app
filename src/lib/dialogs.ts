import { Alert, Platform } from 'react-native';

/** 確認對話框（手機用系統 Alert；Web 的 Alert 沒有作用，改用 window.confirm） */
export function confirmAction(
  title: string,
  message: string,
  confirmText = '確定',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '取消', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
