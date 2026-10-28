/** 把（已依日期排序的）交易依日期分組，保留原本順序，給 SectionList 使用 */
export function groupByDate<T extends { occurred_on: string }>(
  items: T[],
): { date: string; data: T[] }[] {
  const sections: { date: string; data: T[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.date === item.occurred_on) {
      last.data.push(item);
    } else {
      sections.push({ date: item.occurred_on, data: [item] });
    }
  }
  return sections;
}
