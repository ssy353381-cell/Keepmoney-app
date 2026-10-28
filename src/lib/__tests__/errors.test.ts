import { toErrorMessage } from '@/lib/errors';

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

  it('網路錯誤', () => {
    expect(toErrorMessage(new TypeError('Network request failed'))).toContain('無法連線');
  });

  it('未知錯誤保留原訊息', () => {
    expect(toErrorMessage({ code: 'XX000', message: 'boom' })).toBe('boom');
    expect(toErrorMessage(null)).toBe('發生未知的錯誤，請稍後再試');
  });
});
