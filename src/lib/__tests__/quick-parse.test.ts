import {
  EXPENSE_CATEGORY_KEYWORDS,
  INCOME_CATEGORY_KEYWORDS,
  parseChineseNumber,
  parseQuickText,
} from '../quick-parse';

const TODAY = '2026-11-25';

function parse(text: string, today = TODAY) {
  return parseQuickText(text, today);
}

describe('parseChineseNumber', () => {
  it.each([
    ['一百二', 120],
    ['一百二十', 120],
    ['兩百五', 250],
    ['三千', 3000],
    ['三千五', 3500],
    ['一萬五', 15000],
    ['一千零五十', 1050],
    ['十五', 15],
    ['兩百', 200],
    ['五十塊', 50],
    ['二十元', 20],
    ['1.5萬', 15000],
    ['3千', 3000],
    ['2萬3', 23000],
    ['壹佰貳拾', 120],
    ['一萬零五百', 10500],
    ['120', 120],
    ['1,200', 1200],
  ])('「%s」=> %d', (input, expected) => {
    expect(parseChineseNumber(input)).toBe(expected);
  });

  it.each(['', '午餐', '零', '百', '萬', '二三'])('「%s」解析不到回傳 null', (input) => {
    expect(parseChineseNumber(input)).toBeNull();
  });
});

describe('金額', () => {
  it.each([
    ['120', 120],
    ['120元', 120],
    ['120塊', 120],
    ['$120', 120],
    ['NT$80', 80],
    ['NT 80', 80],
    ['1,200', 1200],
    ['12.5', 12.5],
    ['１２０', 120],
    ['一百二', 120],
    ['兩百五', 250],
    ['五十塊', 50],
    ['二十元', 20],
    ['1.5萬', 15000],
    ['3千', 3000],
    ['2萬3', 23000],
  ])('「%s」=> %d', (input, expected) => {
    expect(parse(input).amount).toBe(expected);
  });

  it('沒有金額回傳 null', () => {
    expect(parse('跟朋友吃飯').amount).toBeNull();
  });

  it('空字串：沒有金額、收支為支出、日期為今天、備註為空', () => {
    expect(parse('')).toEqual({
      amount: null,
      type: 'expense',
      occurredOn: TODAY,
      categoryName: null,
      note: '',
    });
  });

  it('只有數字 120', () => {
    expect(parse('120')).toEqual({
      amount: 120,
      type: 'expense',
      occurredOn: TODAY,
      categoryName: null,
      note: '',
    });
  });

  it('只有文字沒有金額', () => {
    const r = parse('買了一個便當');
    expect(r.amount).toBeNull();
    expect(r.categoryName).toBe('飲食');
    expect(r.note).toBe('買了一個便當');
  });

  it('單一中文數字字（一個、百貨）不當成金額', () => {
    expect(parse('去百貨公司逛逛').amount).toBeNull();
    expect(parse('三明治 60').amount).toBe(60);
  });

  it('多個數字時優先取帶標記的', () => {
    expect(parse('2杯咖啡 共120元 另外3').amount).toBe(120);
    expect(parse('買了3個 NT$450').amount).toBe(450);
  });

  it('沒有標記時取最後一個', () => {
    expect(parse('2 杯咖啡 150').amount).toBe(150);
  });

  it('排除日期的數字後取最後一個', () => {
    expect(parse('10/28 午餐 120').amount).toBe(120);
    expect(parse('120 午餐 10/28').amount).toBe(120);
    expect(parse('10月28日 晚餐 300').amount).toBe(300);
    expect(parse('28號 電費 1500').amount).toBe(1500);
  });

  it('金額超過上限或為 0 視為沒有金額', () => {
    expect(parse('0').amount).toBeNull();
    expect(parse('9999999999999').amount).toBeNull();
    expect(parse('999999999999.99').amount).toBe(999999999999.99);
  });

  it('「3C」之類英文縮寫不當成金額', () => {
    const r = parse('3C 配件 450');
    expect(r.amount).toBe(450);
    expect(r.categoryName).toBe('購物');
  });
});

describe('日期', () => {
  it.each([
    ['今天 午餐 100', '2026-11-25'],
    ['昨天 午餐 100', '2026-11-24'],
    ['前天 午餐 100', '2026-11-23'],
    ['大前天 午餐 100', '2026-11-22'],
    ['午餐 100', '2026-11-25'],
    ['10/28 午餐 100', '2026-10-28'],
    ['10月28日 午餐 100', '2026-10-28'],
    ['10月28號 午餐 100', '2026-10-28'],
    ['28日 午餐 100', '2026-10-28'],
    ['20號 午餐 100', '2026-11-20'],
    ['12/25 午餐 100', '2025-12-25'],
    ['11/25 午餐 100', '2026-11-25'],
  ])('「%s」=> %s', (input, expected) => {
    expect(parse(input).occurredOn).toBe(expected);
  });

  it('只有日且在 today 之後視為上個月', () => {
    expect(parse('28號 電費 1500').occurredOn).toBe('2026-10-28');
  });

  it('只有日且在 1 月初的未來日跨到去年 12 月', () => {
    expect(parse('28號 電費 1500', '2027-01-05').occurredOn).toBe('2026-12-28');
  });

  it('月/日在今天之後視為去年', () => {
    expect(parse('12/31 聚餐 800').occurredOn).toBe('2025-12-31');
  });

  it('不合法日期（2/30）忽略，維持今天，且數字不當成金額', () => {
    const r = parse('2/30 午餐 100');
    expect(r.occurredOn).toBe(TODAY);
    expect(r.amount).toBe(100);
    expect(r.note).toBe('午餐');
  });

  it('跨年的昨天', () => {
    expect(parse('昨天 午餐 100', '2027-01-01').occurredOn).toBe('2026-12-31');
  });

  it('閏年的前天', () => {
    expect(parse('前天 午餐 100', '2028-03-01').occurredOn).toBe('2028-02-28');
    expect(parse('昨天 午餐 100', '2028-03-01').occurredOn).toBe('2028-02-29');
  });

  it('今天不是合法日期字串時丟出錯誤', () => {
    expect(() => parseQuickText('午餐 100', '2026/11/25')).toThrow(RangeError);
    expect(() => parseQuickText('午餐 100', '2026-02-30')).toThrow(RangeError);
  });
});

describe('收入／支出', () => {
  it.each([
    '薪水 45000',
    '薪資入帳 45000',
    '月薪 45000',
    '獎金 5000',
    '年終 一萬五',
    '紅包收入 600',
    '收入 100',
    '入帳 100',
    '進帳 100',
    '利息 12',
    '股利 3000',
    '股息 3000',
    '配息 3000',
    '退款 199',
    '退費 199',
    '兼職 1200',
    '打工 1200',
    '接案 8000',
    '稿費 2000',
  ])('「%s」是收入', (input) => {
    expect(parse(input).type).toBe('income');
  });

  it('一般文字預設是支出', () => {
    expect(parse('午餐 120').type).toBe('expense');
  });
});

describe('分類', () => {
  it.each([
    ['午餐 120', '飲食'],
    ['手搖 60', '飲食'],
    ['捷運 35元', '交通'],
    ['10/28 加油 1,200', '交通'],
    ['衣服 800', '購物'],
    ['衛生紙 99', '日用品'],
    ['房租 12000', '居家'],
    ['電費 1500', '帳單'],
    ['電影 300', '娛樂'],
    ['掛號 150', '醫療'],
    ['課程 2000', '教育'],
    ['請客 500', '社交'],
    ['隨便 100', null],
  ])('「%s」=> %s', (input, expected) => {
    expect(parse(input).categoryName).toBe(expected);
  });

  it('多個分類命中時取最長的關鍵字（早午餐優先於早餐）', () => {
    expect(parse('早午餐 兩百五').categoryName).toBe('飲食');
    // 聚餐（社交，2 字）比餐（飲食，1 字）長
    expect(parse('同事聚餐 600').categoryName).toBe('社交');
  });

  it('Uber 是交通，Uber Eats 是飲食（不分大小寫）', () => {
    expect(parse('Uber 280').categoryName).toBe('交通');
    expect(parse('Uber Eats 320').categoryName).toBe('飲食');
    expect(parse('uber eats 320').categoryName).toBe('飲食');
    expect(parse('FOODPANDA 200').categoryName).toBe('飲食');
  });

  it('收入只比對收入表、支出只比對支出表', () => {
    expect(parse('薪水 45000').categoryName).toBe('薪資');
    expect(parse('一萬五 年終').categoryName).toBe('獎金');
    expect(parse('股息 3000').categoryName).toBe('投資');
    expect(parse('打工 1200').categoryName).toBe('兼職');
    // 「午餐」是支出關鍵字，收入句子不會對應到飲食
    expect(parse('退款 午餐 100').categoryName).toBeNull();
    // 「薪水」是收入關鍵字，不會出現在支出表
    expect(Object.values(EXPENSE_CATEGORY_KEYWORDS).flat()).not.toContain('薪水');
  });

  it('關鍵字表的 key 對應預設分類名稱', () => {
    expect(Object.keys(EXPENSE_CATEGORY_KEYWORDS)).toEqual(
      expect.arrayContaining([
        '飲食',
        '交通',
        '購物',
        '日用品',
        '居家',
        '帳單',
        '娛樂',
        '醫療',
        '教育',
        '社交',
      ]),
    );
    expect(Object.keys(INCOME_CATEGORY_KEYWORDS)).toEqual(['薪資', '獎金', '投資', '兼職']);
  });
});

describe('備註', () => {
  it('去掉金額與日期詞，保留其他文字', () => {
    expect(parse('昨天跟同事吃拉麵 250').note).toBe('跟同事吃拉麵');
  });

  it('午餐 120 與 120 午餐', () => {
    expect(parse('午餐 120')).toEqual({
      amount: 120,
      type: 'expense',
      occurredOn: TODAY,
      categoryName: '飲食',
      note: '午餐',
    });
    expect(parse('120 午餐').note).toBe('午餐');
  });

  it('昨天午餐120', () => {
    expect(parse('昨天午餐120')).toEqual({
      amount: 120,
      type: 'expense',
      occurredOn: '2026-11-24',
      categoryName: '飲食',
      note: '午餐',
    });
  });

  it('10/28 加油 1,200', () => {
    expect(parse('10/28 加油 1,200')).toEqual({
      amount: 1200,
      type: 'expense',
      occurredOn: '2026-10-28',
      categoryName: '交通',
      note: '加油',
    });
  });

  it('28號 電費 1500（日期在未來 -> 上個月）', () => {
    expect(parse('28號 電費 1500')).toEqual({
      amount: 1500,
      type: 'expense',
      occurredOn: '2026-10-28',
      categoryName: '帳單',
      note: '電費',
    });
  });

  it('薪水 45000', () => {
    expect(parse('薪水 45000')).toEqual({
      amount: 45000,
      type: 'income',
      occurredOn: TODAY,
      categoryName: '薪資',
      note: '薪水',
    });
  });

  it('一萬五 年終', () => {
    expect(parse('一萬五 年終')).toEqual({
      amount: 15000,
      type: 'income',
      occurredOn: TODAY,
      categoryName: '獎金',
      note: '年終',
    });
  });

  it('捷運 35元', () => {
    expect(parse('捷運 35元')).toEqual({
      amount: 35,
      type: 'expense',
      occurredOn: TODAY,
      categoryName: '交通',
      note: '捷運',
    });
  });

  it('NT$1.5萬 機票', () => {
    expect(parse('NT$1.5萬 機票')).toEqual({
      amount: 15000,
      type: 'expense',
      occurredOn: TODAY,
      categoryName: '交通',
      note: '機票',
    });
  });

  it('Uber 280 與 Uber Eats 320 的備註', () => {
    expect(parse('Uber 280').note).toBe('Uber');
    expect(parse('Uber Eats 320').note).toBe('Uber Eats');
  });

  it('標記（元／塊／$／NT）一併從備註移除', () => {
    expect(parse('咖啡 80塊').note).toBe('咖啡');
    expect(parse('咖啡 80 元').note).toBe('咖啡');
    expect(parse('咖啡 $80').note).toBe('咖啡');
    expect(parse('咖啡 NT$80').note).toBe('咖啡');
    expect(parse('咖啡 NT 80').note).toBe('咖啡');
  });

  it('壓縮多餘空白並去掉頭尾分隔符號', () => {
    expect(parse('  午餐，   便當   120  ').note).toBe('午餐， 便當');
    expect(parse('午餐， 120').note).toBe('午餐');
  });

  it('備註最多 200 字', () => {
    const long = '好'.repeat(300);
    expect(parse(`${long} 100`).note).toHaveLength(200);
  });

  it('全形數字與全形空白', () => {
    const r = parse('午餐　１２０元');
    expect(r.amount).toBe(120);
    expect(r.note).toBe('午餐');
  });
});
