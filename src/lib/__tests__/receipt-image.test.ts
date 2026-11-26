import { fitWithin } from '../receipt-image';

describe('fitWithin', () => {
  it('橫式照片以寬度為長邊', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600 });
  });
  it('直式照片以高度為長邊', () => {
    expect(fitWithin(3000, 4000)).toEqual({ height: 1600 });
  });
  it('正方形', () => {
    expect(fitWithin(2000, 2000)).toEqual({ width: 1600 });
  });
  it('已經夠小就不縮', () => {
    expect(fitWithin(1600, 900)).toBeNull();
    expect(fitWithin(800, 600)).toBeNull();
  });
  it('尺寸不合法時不縮', () => {
    expect(fitWithin(0, 0)).toBeNull();
    expect(fitWithin(NaN, 100)).toBeNull();
  });
  it('可以指定上限', () => {
    expect(fitWithin(1000, 500, 800)).toEqual({ width: 800 });
  });
});
