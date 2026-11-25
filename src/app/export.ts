// Material list export: Markdown and forum BBCode (forum.minecraft-galaxy.ru, wiki/201).

export interface MaterialRow {
  count: number;
  /** "id:meta" */
  key: string;
  name: string;
}

export interface MaterialList {
  fileName: string;
  size: { x: number; y: number; z: number };
  rows: MaterialRow[];
}

const total = (l: MaterialList) => l.rows.reduce((a, r) => a + r.count, 0);
const sorted = (l: MaterialList) =>
  [...l.rows].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'en', { numeric: true }));

/** Markdown: heading, size and total, then a table. */
export function materialsMarkdown(l: MaterialList): string {
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  const lines = [
    `## Список материалов для ${esc(l.fileName)}`,
    '',
    `Размер: ${l.size.x} x ${l.size.y} x ${l.size.z}  `,
    `Всего блоков: ${total(l)}`,
    '',
    '| Кол-во | ID | Название |',
    '|---:|:---|:---|',
    ...sorted(l).map((r) => `| ${r.count} | ${r.key} | ${esc(r.name)} |`),
  ];
  return lines.join('\n') + '\n';
}

/** Forum item tag: `[item=id:meta:count]`; without a count — `[item=id:meta]`, or `[item=id]` for meta 0. */
export function itemTag(key: string, count?: number): string {
  const [id, meta = '0'] = key.split(':');
  if (count !== undefined) return `[item=${id}:${meta}:${count}]`;
  return meta === '0' ? `[item=${id}]` : `[item=${id}:${meta}]`;
}

/**
 * Forum BBCode. The forum table: one row per line, `||` between header cells, `|` between cells.
 * The first column shows the game item with its count.
 */
export function materialsBbcode(l: MaterialList): string {
  const cell = (s: string) => s.replace(/\|/g, '/');
  const lines = [
    `[b]Список материалов для ${l.fileName}[/b]`,
    `Размер: ${l.size.x} x ${l.size.y} x ${l.size.z}`,
    `Всего блоков: ${total(l)}`,
    '[table]',
    'Блок || Кол-во || ID || Название',
    ...sorted(l).map((r) => `${itemTag(r.key, r.count)} | ${r.count} шт. | ${r.key} | ${cell(r.name)}`),
    '[/table]',
  ];
  return lines.join('\n') + '\n';
}
