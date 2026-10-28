import { useQuery } from '@tanstack/react-query';

import { ledgerKeys, unwrap } from '@/api/keys';
import { supabase } from '@/lib/supabase';
import { useLedger } from '@/providers/ledger-provider';
import type { Enums, Tables } from '@/types/database';

export type Category = Tables<'categories'>;
export type CategoryKind = Enums<'category_kind'>;

export function useCategories() {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.categories(ledger.id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('categories')
          .select('*')
          .eq('ledger_id', ledger.id)
          .order('sort_order')
          .order('name'),
      ),
  });
}

/** 顯示用名稱：子分類顯示成「飲食・早餐」 */
export function categoryLabel(category: Category, byId: Map<string, Category>): string {
  const parent = category.parent_id ? byId.get(category.parent_id) : undefined;
  return parent ? `${parent.name}・${category.name}` : category.name;
}

/** 分類圖示：子分類沒有自己的圖示時沿用父分類 */
export function categoryIcon(category: Category, byId: Map<string, Category>): string {
  const parent = category.parent_id ? byId.get(category.parent_id) : undefined;
  return category.icon ?? parent?.icon ?? '🏷️';
}
