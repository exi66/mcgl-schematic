import { describe, expect, it } from 'vitest';
import { itemTag, materialsBbcode, materialsMarkdown, type MaterialList } from '../src/app/export';

const list: MaterialList = {
  fileName: 'bak.schematic',
  size: { x: 128, y: 8, z: 128 },
  rows: [
    { count: 8456, key: '158:0', name: 'Сверхпроводник' },
    { count: 9000, key: '79:0', name: 'Лед' },
    { count: 3, key: '42:6', name: 'Ти|тан' },
  ],
};

describe('materials export', () => {
  it('item tag: [item=id:meta:count]', () => {
    expect(itemTag('41:0')).toBe('[item=41]');
    expect(itemTag('42:6')).toBe('[item=42:6]');
    expect(itemTag('42:6', 64)).toBe('[item=42:6:64]');
    expect(itemTag('79:0', 8456)).toBe('[item=79:0:8456]');
  });

  it('markdown: header, totals, table sorted by count', () => {
    const md = materialsMarkdown(list);
    expect(md).toContain('## Список материалов для bak.schematic');
    expect(md).toContain('Размер: 128 x 8 x 128');
    expect(md).toContain('Всего блоков: 17459');
    const rows = md.split('\n').filter((l) => /^\| \d/.test(l));
    expect(rows).toEqual(['| 9000 | 79:0 | Лед |', '| 8456 | 158:0 | Сверхпроводник |', '| 3 | 42:6 | Ти\\|тан |']);
  });

  it('bbcode: forum table with || header and | cells', () => {
    const bb = materialsBbcode(list);
    const lines = bb.trim().split('\n');
    expect(lines[0]).toBe('[b]Список материалов для bak.schematic[/b]');
    expect(lines).toContain('[table]');
    expect(lines).toContain('Блок || Кол-во || ID || Название');
    expect(lines).toContain('[item=79:0:9000] | 9000 шт. | 79:0 | Лед');
    expect(lines).toContain('[item=42:6:3] | 3 шт. | 42:6 | Ти/тан');
    expect(lines.at(-1)).toBe('[/table]');
  });
});
