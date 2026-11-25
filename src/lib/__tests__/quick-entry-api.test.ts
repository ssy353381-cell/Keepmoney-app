import {
  errorReply,
  readQuickEntryRequest,
  successReply,
  todayInTimeZone,
} from '../quick-entry-api';

describe('readQuickEntryRequest', () => {
  it('header 金鑰＋合法 body', () => {
    expect(readQuickEntryRequest({ text: '午餐 120', date: '2026-11-25' }, 'km_abc')).toEqual({
      ok: true,
      value: { text: '午餐 120', date: '2026-11-25', token: 'km_abc' },
    });
  });

  it('金鑰可放在 body.token', () => {
    const r = readQuickEntryRequest({ text: '午餐 120', token: 'km_body' }, null);
    expect(r).toEqual({ ok: true, value: { text: '午餐 120', date: null, token: 'km_body' } });
  });

  it('header 優先於 body.token', () => {
    const r = readQuickEntryRequest({ text: 'a 1', token: 'km_body' }, 'km_header');
    expect(r.ok && r.value.token).toBe('km_header');
  });

  it('header 為空白時改用 body.token', () => {
    const r = readQuickEntryRequest({ text: 'a 1', token: 'km_body' }, '   ');
    expect(r.ok && r.value.token).toBe('km_body');
  });

  it('金鑰前後空白會被去掉', () => {
    const r = readQuickEntryRequest({ text: 'a 1' }, '  km_x  ');
    expect(r.ok && r.value.token).toBe('km_x');
  });

  it('沒有金鑰 → 401', () => {
    const r = readQuickEntryRequest({ text: '午餐 120' }, null);
    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(!r.ok && r.message).toContain('缺少捷徑金鑰');
  });

  it('body.token 不是字串 → 視為沒有金鑰', () => {
    expect(readQuickEntryRequest({ text: 'a 1', token: 123 }, null)).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it('body 不是物件 → 400', () => {
    expect(readQuickEntryRequest('午餐 120', 'k')).toMatchObject({ ok: false, status: 400 });
    expect(readQuickEntryRequest(null, 'k')).toMatchObject({ ok: false, status: 400 });
    expect(readQuickEntryRequest(undefined, 'k')).toMatchObject({ ok: false, status: 400 });
    expect(readQuickEntryRequest(['午餐 120'], 'k')).toMatchObject({ ok: false, status: 400 });
    expect(readQuickEntryRequest(42, 'k')).toMatchObject({ ok: false, status: 400 });
  });

  it('text 缺少或不是字串 → 400', () => {
    expect(readQuickEntryRequest({}, 'k')).toMatchObject({ ok: false, status: 400 });
    expect(readQuickEntryRequest({ text: 120 }, 'k')).toMatchObject({ ok: false, status: 400 });
    expect(readQuickEntryRequest({ text: null }, 'k')).toMatchObject({ ok: false, status: 400 });
  });

  it('text 只有空白 → 400', () => {
    expect(readQuickEntryRequest({ text: '   \n ' }, 'k')).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('text 會 trim', () => {
    const r = readQuickEntryRequest({ text: '  午餐 120  ' }, 'k');
    expect(r.ok && r.value.text).toBe('午餐 120');
  });

  it('text 剛好 200 字可以，201 字不行', () => {
    expect(readQuickEntryRequest({ text: 'a'.repeat(200) }, 'k').ok).toBe(true);
    expect(readQuickEntryRequest({ text: 'a'.repeat(201) }, 'k')).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('date 不合法就忽略', () => {
    for (const date of [
      '2026-13-01',
      '2026-02-30',
      '2026/11/25',
      '昨天',
      '',
      '2026-1-5',
      20261125,
      null,
    ]) {
      const r = readQuickEntryRequest({ text: 'a 1', date }, 'k');
      expect(r.ok && r.value.date).toBeNull();
    }
  });

  it('date 合法（含閏日）會保留', () => {
    const r = readQuickEntryRequest({ text: 'a 1', date: '2028-02-29' }, 'k');
    expect(r.ok && r.value.date).toBe('2028-02-29');
  });

  it('沒有 date 欄位 → null', () => {
    const r = readQuickEntryRequest({ text: 'a 1' }, 'k');
    expect(r.ok && r.value.date).toBeNull();
  });
});

describe('todayInTimeZone', () => {
  it('台北時間跨日：UTC 16:00 已是台北隔天', () => {
    expect(todayInTimeZone(new Date('2026-11-25T16:00:00Z'))).toBe('2026-11-26');
  });

  it('台北時間同一天', () => {
    expect(todayInTimeZone(new Date('2026-11-25T15:59:00Z'))).toBe('2026-11-25');
  });

  it('可指定其他時區', () => {
    expect(todayInTimeZone(new Date('2026-11-25T03:00:00Z'), 'America/Los_Angeles')).toBe(
      '2026-11-24',
    );
  });

  it('跨年', () => {
    expect(todayInTimeZone(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
  });
});

describe('successReply', () => {
  const base = {
    type: 'expense' as const,
    amount: 120,
    note: '午餐',
    categoryName: '飲食',
    accountName: '現金',
    occurredOn: '2026-11-25',
    today: '2026-11-25',
  };

  it('支出、今天', () => {
    expect(successReply(base)).toBe(
      '✅ 已記下：午餐 $120（飲食・現金）\n日期：今天｜之後可到 KeepMoney 補細節',
    );
  });

  it('收入使用不同開頭', () => {
    const text = successReply({
      ...base,
      type: 'income',
      note: '薪水',
      amount: 50000,
      categoryName: '薪資',
    });
    expect(text.startsWith('💰 已記下收入：薪水 $50,000')).toBe(true);
  });

  it('昨天、前天', () => {
    expect(successReply({ ...base, occurredOn: '2026-11-24' })).toContain('日期：昨天');
    expect(successReply({ ...base, occurredOn: '2026-11-23' })).toContain('日期：前天');
  });

  it('更早的日期顯示 M/D（不補零）', () => {
    expect(successReply({ ...base, occurredOn: '2026-11-05' })).toContain('日期：11/5');
    expect(successReply({ ...base, occurredOn: '2026-01-09' })).toContain('日期：1/9');
  });

  it('跨月、跨年的昨天', () => {
    expect(successReply({ ...base, today: '2026-12-01', occurredOn: '2026-11-30' })).toContain(
      '日期：昨天',
    );
    expect(successReply({ ...base, today: '2027-01-01', occurredOn: '2026-12-31' })).toContain(
      '日期：昨天',
    );
  });

  it('千分位與小數', () => {
    expect(successReply({ ...base, amount: 1234567.5 })).toContain('$1,234,567.5（');
    expect(successReply({ ...base, amount: 99.99 })).toContain('$99.99（');
    expect(successReply({ ...base, amount: 0.1 + 0.2 })).toContain('$0.3（');
  });

  it('沒有備註時省略標題', () => {
    expect(successReply({ ...base, note: '' })).toContain('✅ 已記下：$120（');
    expect(successReply({ ...base, note: '   ' })).toContain('✅ 已記下：$120（');
  });
});

describe('errorReply', () => {
  it('28000 → 401，使用資料庫訊息', () => {
    expect(
      errorReply({ code: '28000', message: '捷徑金鑰無效或已撤銷，請到 App 的設定重新產生' }, 400),
    ).toEqual({
      status: 401,
      message: '捷徑金鑰無效或已撤銷，請到 App 的設定重新產生',
    });
  });

  it('42501 → 403', () => {
    expect(
      errorReply({ code: '42501', message: '這把金鑰的主人已沒有這本帳本的記帳權限' }, 403),
    ).toEqual({
      status: 403,
      message: '這把金鑰的主人已沒有這本帳本的記帳權限',
    });
  });

  it('P0001 → 422', () => {
    expect(errorReply({ code: 'P0001', message: '記太快了，請稍後再試' }, 400)).toEqual({
      status: 422,
      message: '記太快了，請稍後再試',
    });
  });

  it('其他錯誤碼 → 500 且不透露內部細節', () => {
    const r = errorReply(
      { code: '42P01', message: 'relation "public.secret" does not exist' },
      404,
    );
    expect(r).toEqual({ status: 500, message: '伺服器暫時有問題，請稍後再試' });
  });

  it('PGRST 錯誤 → 500', () => {
    expect(
      errorReply({ code: 'PGRST202', message: 'Could not find the function' }, 404).status,
    ).toBe(500);
  });

  it('沒有錯誤物件 → 500', () => {
    expect(errorReply(null, 502)).toEqual({ status: 500, message: '伺服器暫時有問題，請稍後再試' });
  });

  it('沒有 code → 500', () => {
    expect(errorReply({ message: 'boom' }, 400).status).toBe(500);
  });

  it('已知錯誤碼但訊息為空時用預設訊息', () => {
    expect(errorReply({ code: 'P0001' }, 400)).toMatchObject({ status: 422 });
    expect(errorReply({ code: 'P0001' }, 400).message).not.toBe('');
  });
});
