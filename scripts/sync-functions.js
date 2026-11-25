// 把 src/lib 的純函式複製到 Supabase Edge Function 的共用資料夾（Deno 不能 import App 的檔案）。
// 執行：npm run sync:functions
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const files = ['quick-parse.ts', 'quick-entry-api.ts'];
const targetDir = path.join(root, 'supabase', 'functions', '_shared');

fs.mkdirSync(targetDir, { recursive: true });
for (const name of files) {
  const source = fs.readFileSync(path.join(root, 'src', 'lib', name), 'utf8');
  const header = `// 此檔由 npm run sync:functions 從 src/lib/${name} 產生，請勿直接修改\n`;
  fs.writeFileSync(path.join(targetDir, name), header + source);
  console.log(`已同步 ${name}`);
}
