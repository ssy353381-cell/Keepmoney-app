import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { accountTypeInfo, useAccounts } from '@/api/accounts';
import {
  useExistingInvoiceNumbers,
  useImportCarrierInvoices,
  usePickCarrierFile,
  type CarrierImportResult,
} from '@/api/carrier-import';
import { useCategories } from '@/api/categories';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChipGroup } from '@/components/ui/chip-group';
import { ErrorView, LoadingView } from '@/components/ui/status-views';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { planCarrierImport, type CarrierParseResult } from '@/lib/carrier-import';
import { buildCarrierRows, type CarrierRow } from '@/lib/carrier-plan';
import { confirmAction } from '@/lib/dialogs';
import { toErrorMessage } from '@/lib/errors';
import { formatMoney, sumAmounts } from '@/lib/money';

const SKIPPED_PREVIEW = 5;

export default function CarrierImportScreen() {
  const router = useRouter();
  const theme = useTheme();
  const accounts = useAccounts();
  const categories = useCategories();
  const existing = useExistingInvoiceNumbers();
  const pick = usePickCarrierFile();
  const importer = useImportCarrierInvoices();

  const [parsed, setParsed] = useState<CarrierParseResult | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<CarrierImportResult | null>(null);

  const activeAccounts = useMemo(
    () => (accounts.data ?? []).filter((a) => !a.is_archived),
    [accounts.data],
  );
  const selectedAccountId = accountId ?? activeAccounts[0]?.id ?? null;

  const plan = useMemo(
    () => (parsed && existing.data ? planCarrierImport(parsed.invoices, existing.data) : null),
    [parsed, existing.data],
  );
  const rows = useMemo(
    () => (plan && categories.data ? buildCarrierRows(plan.toImport, categories.data) : []),
    [plan, categories.data],
  );
  const noCategory = plan !== null && plan.toImport.length > 0 && rows.length === 0;
  const categoryNames = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );

  const selectedRows = useMemo(
    () => rows.filter((r) => !excluded.has(r.invoice.invoiceNumber)),
    [rows, excluded],
  );
  const total = useMemo(
    () => sumAmounts(selectedRows.map((r) => r.invoice.amount)),
    [selectedRows],
  );

  const toggle = useCallback((invoiceNumber: string, value: boolean) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (value) {
        next.delete(invoiceNumber);
      } else {
        next.add(invoiceNumber);
      }
      return next;
    });
  }, []);

  async function handlePick() {
    setPickError(null);
    setImportError(null);
    setResult(null);
    try {
      const picked = await pick.mutateAsync();
      if (picked) {
        setParsed(picked);
        setExcluded(new Set());
        // 重新查一次已記過的發票，避免用到過期的快取
        void existing.refetch();
      }
    } catch (e) {
      setParsed(null);
      setPickError(toErrorMessage(e));
    }
  }

  async function handleImport() {
    if (!selectedAccountId || selectedRows.length === 0) {
      return;
    }
    const confirmed = await confirmAction(
      '確認匯入',
      `會一次記下 ${selectedRows.length} 筆支出，合計 ${formatMoney(total)}，都會標成待確認。確定要匯入嗎？`,
      '匯入',
    );
    if (!confirmed) {
      return;
    }
    setImportError(null);
    try {
      const done = await importer.mutateAsync({ rows: selectedRows, accountId: selectedAccountId });
      setResult(done);
      setParsed(null);
    } catch (e) {
      setImportError(toErrorMessage(e));
    }
  }

  const renderItem = useCallback(
    ({ item }: { item: CarrierRow }) => (
      <InvoiceRow
        row={item}
        categoryName={item.categoryMatched ? (categoryNames.get(item.categoryId) ?? '') : ''}
        included={!excluded.has(item.invoice.invoiceNumber)}
        onToggle={toggle}
      />
    ),
    [categoryNames, excluded, toggle],
  );

  if (accounts.isLoading || categories.isLoading) {
    return <LoadingView />;
  }
  if (accounts.error || categories.error) {
    return (
      <ErrorView
        message={toErrorMessage(accounts.error ?? categories.error)}
        onRetry={() => {
          void accounts.refetch();
          void categories.refetch();
        }}
      />
    );
  }

  const skipped = parsed?.skipped ?? [];
  const showPreview = parsed !== null && plan !== null && rows.length > 0;
  const emptyMessage =
    parsed === null || plan === null || noCategory
      ? null
      : plan.toImport.length === 0
        ? plan.duplicates > 0 && plan.voided === 0
          ? '這個檔案裡的發票都已經記過了'
          : parsed.invoices.length === 0
            ? '這個檔案裡沒有讀到任何發票'
            : '這個檔案裡沒有可以匯入的發票（都已經記過或已作廢）'
        : null;

  const header = (
    <View style={styles.header}>
      <Card>
        <ThemedText type="smallBold">怎麼取得明細檔</ThemedText>
        <ThemedText type="small">
          1.
          用電腦或手機瀏覽器登入財政部電子發票整合服務平台（einvoice.nat.gov.tw），以手機條碼登入。
        </ThemedText>
        <ThemedText type="small">
          2.
          到手機條碼的消費發票查詢頁，選日期區間查詢後匯出明細檔（平台介面可能會改版，以實際畫面為準）。
        </ThemedText>
        <ThemedText type="small">
          3. 把檔案存到「檔案」App 或 iCloud Drive，回到這裡選擇檔案。
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          匯入的發票會標成待確認，分類是依店名猜的，之後可以再改。已經記過的發票（包括掃描過 QR code
          的）會自動略過。
        </ThemedText>
      </Card>

      <Button
        title={parsed || result ? '重新選擇明細檔' : '選擇明細檔'}
        variant="secondary"
        onPress={handlePick}
        loading={pick.isPending}
        disabled={importer.isPending}
      />
      {pickError && <ThemedText style={{ color: theme.danger }}>{pickError}</ThemedText>}

      {result && (
        <Card>
          <ThemedText type="smallBold">{result.failure ? '匯入中斷' : '匯入完成'}</ThemedText>
          <ThemedText>
            {result.failure
              ? `已匯入 ${result.imported} 筆，之後的失敗：${result.failure}`
              : `已匯入 ${result.imported} 筆支出，都標成待確認。`}
          </ThemedText>
          {result.failure && (
            <ThemedText type="small" themeColor="textSecondary">
              已寫入的不會回滾。可以重新選擇同一個檔案，已記過的發票會自動略過，只匯入剩下的。
            </ThemedText>
          )}
          {!result.failure && <Button title="完成" onPress={() => router.back()} />}
        </Card>
      )}

      {parsed && existing.isLoading && <LoadingBlock />}
      {parsed && existing.error && (
        <ErrorView
          message={`無法確認哪些發票已經記過：${toErrorMessage(existing.error)}`}
          onRetry={() => void existing.refetch()}
        />
      )}

      {parsed && plan && (
        <Card>
          <ThemedText type="smallBold">解析結果</ThemedText>
          <ThemedText type="small">
            可匯入 {plan.toImport.length} 筆、已記過 {plan.duplicates} 筆、作廢 {plan.voided} 筆、
            無法讀取 {skipped.length} 行
          </ThemedText>
          {showPreview && (
            <ThemedText type="small">
              選取 {selectedRows.length} 筆，合計 {formatMoney(total)}
            </ThemedText>
          )}
          {skipped.length > 0 && (
            <View style={styles.skipped}>
              <ThemedText type="small" themeColor="textSecondary">
                無法讀取的行（前 {Math.min(SKIPPED_PREVIEW, skipped.length)} 筆）：
              </ThemedText>
              {skipped.slice(0, SKIPPED_PREVIEW).map((s) => (
                <ThemedText key={s.line} type="small" themeColor="textSecondary">
                  第 {s.line} 行：{s.reason}
                </ThemedText>
              ))}
            </View>
          )}
        </Card>
      )}

      {noCategory && (
        <ThemedText style={{ color: theme.danger }}>
          找不到可用的支出分類，請先到設定新增支出分類再匯入
        </ThemedText>
      )}
      {emptyMessage && <ThemedText>{emptyMessage}</ThemedText>}

      {showPreview && (
        <>
          <ChipGroup label="記到哪個帳戶">
            {activeAccounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                icon={accountTypeInfo(a.type).icon}
                selected={a.id === selectedAccountId}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </ChipGroup>
          {activeAccounts.length === 0 && (
            <ThemedText style={{ color: theme.danger }}>
              沒有可用的帳戶，請先新增帳戶再匯入
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            關掉右邊的開關就不會匯入那一張。
          </ThemedText>
        </>
      )}
    </View>
  );

  const footer = showPreview ? (
    <View style={styles.footer}>
      {importError && <ThemedText style={{ color: theme.danger }}>{importError}</ThemedText>}
      <Button
        title={`匯入 ${selectedRows.length} 筆`}
        onPress={handleImport}
        loading={importer.isPending}
        disabled={selectedRows.length === 0 || !selectedAccountId}
      />
    </View>
  ) : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <FlatList
          data={showPreview ? rows : []}
          keyExtractor={(row) => row.invoice.invoiceNumber}
          renderItem={renderItem}
          extraData={excluded}
          ListHeaderComponent={header}
          ListFooterComponent={footer ?? undefined}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          initialNumToRender={20}
          windowSize={7}
          removeClippedSubviews
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function LoadingBlock() {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      正在確認哪些發票已經記過…
    </ThemedText>
  );
}

const InvoiceRow = memo(function InvoiceRow({
  row,
  categoryName,
  included,
  onToggle,
}: {
  row: CarrierRow;
  /** 沒對到分類時傳空字串 */
  categoryName: string;
  included: boolean;
  onToggle: (invoiceNumber: string, value: boolean) => void;
}) {
  const { invoice } = row;
  const title = invoice.storeName?.trim() || `發票 ${invoice.invoiceNumber}`;
  return (
    <View style={[styles.row, !included && styles.rowOff]}>
      <View style={styles.rowMain}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {invoice.date}・{row.categoryMatched ? categoryName : '其他・待確認'}
        </ThemedText>
      </View>
      <ThemedText type="smallBold">{formatMoney(invoice.amount)}</ThemedText>
      <Switch
        value={included}
        onValueChange={(value) => onToggle(invoice.invoiceNumber, value)}
        accessibilityLabel={`匯入 ${title}`}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    padding: Spacing.three,
  },
  header: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  skipped: {
    gap: Spacing.one,
  },
  footer: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowOff: {
    opacity: 0.45,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
});
