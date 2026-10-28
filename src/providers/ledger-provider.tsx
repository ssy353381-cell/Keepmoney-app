import { createContext, use, type PropsWithChildren } from 'react';

import { useLedgers, type Ledger } from '@/api/ledgers';
import { ErrorView, LoadingView } from '@/components/ui/status-views';
import { toErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/auth-provider';

const LedgerContext = createContext<Ledger | null>(null);

/** 目前使用的帳本。現在每人只有一本，先用最早建立的那本 */
export function LedgerProvider({ children }: PropsWithChildren) {
  const user = useUser();
  const ledgers = useLedgers(user.id);

  if (ledgers.isPending) {
    return <LoadingView />;
  }
  if (ledgers.error) {
    return <ErrorView message={toErrorMessage(ledgers.error)} onRetry={() => ledgers.refetch()} />;
  }

  const ledger = ledgers.data[0];
  if (!ledger) {
    return <ErrorView message="找不到帳本，請重新登入" onRetry={() => ledgers.refetch()} />;
  }

  return <LedgerContext value={ledger}>{children}</LedgerContext>;
}

export function useLedger(): Ledger {
  const value = use(LedgerContext);
  if (!value) {
    throw new Error('useLedger 必須在 <LedgerProvider> 裡面使用');
  }
  return value;
}
