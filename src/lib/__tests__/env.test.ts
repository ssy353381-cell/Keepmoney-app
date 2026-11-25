import { quickEntryUrl } from '@/lib/env';

describe('quickEntryUrl', () => {
  it('接上 Edge Function 路徑', () => {
    expect(quickEntryUrl('https://abc.supabase.co')).toBe(
      'https://abc.supabase.co/functions/v1/quick-entry',
    );
  });

  it('去掉結尾斜線', () => {
    expect(quickEntryUrl('https://abc.supabase.co//')).toBe(
      'https://abc.supabase.co/functions/v1/quick-entry',
    );
  });
});
