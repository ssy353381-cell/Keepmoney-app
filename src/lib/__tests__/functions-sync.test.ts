// 專案沒有安裝 @types/node，這裡只宣告用到的最小型別
declare const __dirname: string;
type FsModule = { readFileSync(path: string, encoding: 'utf8'): string };
const { readFileSync } = jest.requireActual<FsModule>('node:fs');

const root = `${__dirname}/../../..`;

describe('Edge Function 共用檔案同步', () => {
  it.each(['quick-parse.ts', 'quick-entry-api.ts'])('%s 的複本與原檔一致', (name) => {
    const source = readFileSync(`${root}/src/lib/${name}`, 'utf8');
    const copy = readFileSync(`${root}/supabase/functions/_shared/${name}`, 'utf8');
    const header = `// 此檔由 npm run sync:functions 從 src/lib/${name} 產生，請勿直接修改\n`;
    // 不一致時 Jest 會顯示此訊息
    if (copy !== header + source) {
      throw new Error(
        `supabase/functions/_shared/${name} 與 src/lib/${name} 不一致，請執行 npm run sync:functions`,
      );
    }
    expect(copy).toBe(header + source);
  });
});
