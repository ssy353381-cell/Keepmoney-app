import { chunk, receiptPath, splitListing } from '../receipt-path';

describe('receiptPath', () => {
  it('組成 <帳本>/<交易>/<檔名>.jpg', () => {
    expect(receiptPath('led-1', 'tx-2', 'file-3')).toBe('led-1/tx-2/file-3.jpg');
  });
});

describe('splitListing', () => {
  it('資料夾（id 為 null）與檔案分開，檔案補上完整路徑', () => {
    const result = splitListing('led-1', [
      { name: 'tx-a', id: null },
      { name: 'tx-b', id: null },
      { name: 'stray.jpg', id: 'obj-1' },
    ]);
    expect(result).toEqual({ files: ['led-1/stray.jpg'], folders: ['tx-a', 'tx-b'] });
  });

  it('第二層：只有檔案', () => {
    expect(
      splitListing('led-1/tx-a', [
        { name: 'x.jpg', id: 'o1' },
        { name: 'y.jpg', id: 'o2' },
      ]),
    ).toEqual({ files: ['led-1/tx-a/x.jpg', 'led-1/tx-a/y.jpg'], folders: [] });
  });

  it('忽略空名稱與 placeholder，空結果', () => {
    expect(
      splitListing('p', [
        { name: '', id: 'o1' },
        { name: '.emptyFolderPlaceholder', id: 'o2' },
      ]),
    ).toEqual({ files: [], folders: [] });
    expect(splitListing('p', [])).toEqual({ files: [], folders: [] });
  });
});

describe('chunk', () => {
  it('切成固定大小', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
