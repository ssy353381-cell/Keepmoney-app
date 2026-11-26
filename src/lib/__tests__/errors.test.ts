import { toErrorMessage, toRestoreErrorMessage } from '@/lib/errors';

describe('toErrorMessage', () => {
  it('翻譯 Auth 錯誤代碼', () => {
    expect(
      toErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    ).toBe('Email 或密碼錯誤');
    expect(
      toErrorMessage({ code: 'email_not_confirmed', message: 'Email not confirmed' }),
    ).toContain('還沒完成驗證');
  });

  it('區分外鍵錯誤是刪除還是新增造成的', () => {
    expect(
      toErrorMessage({
        code: '23503',
        message: 'update or delete on table "accounts" violates foreign key constraint',
      }),
    ).toContain('無法刪除');
    expect(
      toErrorMessage({
        code: '23503',
        message: 'insert or update on table "transactions" violates foreign key constraint',
      }),
    ).toContain('已不存在');
  });

  it('同一張發票重複記帳', () => {
    expect(
      toErrorMessage({
        code: '23505',
        message: 'duplicate key value violates unique constraint "transactions_invoice_number_key"',
      }),
    ).toBe('這張發票已經記過了');
    expect(toErrorMessage({ code: '23505', message: 'duplicate key value' })).toContain('相同');
  });

  it('網路錯誤', () => {
    expect(toErrorMessage(new TypeError('Network request failed'))).toContain('無法連線');
  });

  it('未知錯誤保留原訊息', () => {
    expect(toErrorMessage({ code: 'XX000', message: 'boom' })).toBe('boom');
    expect(toErrorMessage(null)).toBe('發生未知的錯誤，請稍後再試');
  });
});

describe('toRestoreErrorMessage', () => {
  it('外鍵、not null、check 違反都說明已取消還原', () => {
    for (const code of ['23503', '23502', '23514']) {
      expect(
        toRestoreErrorMessage({ code, message: 'insert or update on table "transactions"' }),
      ).toBe('備份裡有資料不完整或不一致，已取消還原，你的資料沒有任何改變');
    }
  });

  it('其他錯誤沿用一般的訊息', () => {
    expect(toRestoreErrorMessage({ code: '42501', message: 'permission denied' })).toBe(
      '沒有權限進行這個操作',
    );
    expect(toRestoreErrorMessage({ message: 'Network request failed' })).toContain('無法連線');
    expect(toRestoreErrorMessage('oops')).toBe('oops');
  });
});
