import { Crosshair, Eye, EyeOff } from 'lucide-react';
import { useMemo } from 'react';
import { blockDef, variantKey, variantMeta, variantName } from '../blocks/pool';
import type { Schematic } from '../schematic/schematic';
import { BlockIcon } from './BlockIcon';
import { cn } from '@/lib/utils';

export interface BlockStat {
  /** Variant key "id:meta" (see variantKey). */
  key: string;
  id: number;
  /** Variant metadata (the item's meta, or 0 for state-only metas). */
  meta: number;
  /** Most common actual metadata (for the icon). */
  iconMeta: number;
  count: number;
  name: string;
}

export function blockStats(s: Schematic): BlockStat[] {
  const byKey = new Map<string, { id: number; meta: number; count: number; metas: Map<number, number> }>();
  for (let i = 0; i < s.blocks.length; i++) {
    const id = s.blocks[i];
    if (id === 0) continue;
    const meta = s.data[i];
    const key = variantKey(id, meta);
    let e = byKey.get(key);
    if (!e) byKey.set(key, (e = { id, meta: variantMeta(id, meta), count: 0, metas: new Map() }));
    e.count++;
    e.metas.set(meta, (e.metas.get(meta) ?? 0) + 1);
  }
  const out: BlockStat[] = [];
  for (const [key, e] of byKey) {
    let iconMeta = e.meta;
    let best = -1;
    for (const [m, n] of e.metas)
      if (n > best) {
        best = n;
        iconMeta = m;
      }
    out.push({ key, id: e.id, meta: e.meta, iconMeta, count: e.count, name: variantName(e.id, e.meta) });
  }
  return out.sort((a, b) => b.count - a.count || a.id - b.id || a.meta - b.meta);
}

export function BlockList({
  stats,
  hidden,
  highlight,
  onToggleHidden,
  onHighlight,
}: {
  stats: BlockStat[];
  hidden: ReadonlySet<string>;
  highlight: string | null;
  onToggleHidden: (key: string) => void;
  onHighlight: (key: string | null) => void;
}) {
  const fmt = useMemo(() => new Intl.NumberFormat('ru-RU'), []);
  return (
    <ul className="flex flex-col gap-px">
      {stats.map((st) => {
        const known = blockDef(st.id) !== undefined;
        const isHidden = hidden.has(st.key);
        const isHl = highlight === st.key;
        return (
          <li key={st.key}>
            <div
              className={cn(
                'group flex items-center gap-2 px-1.5 py-1 text-sm',
                isHl ? 'bg-accent' : 'hover:bg-muted',
                isHidden && 'opacity-45',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onToggleHidden(st.key)}
                title={`${st.name} — ${st.key}${known ? '' : ' (нет в пуле, заглушка)'}\n${isHidden ? 'Показать' : 'Скрыть'}`}
              >
                <BlockIcon id={st.id} meta={st.iconMeta} />
                <span className={cn('min-w-0 flex-1 truncate', !known && 'text-muted-foreground italic')}>
                  {st.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmt.format(st.count)}</span>
                <span className="text-muted-foreground opacity-0 group-hover:opacity-100 [&_svg]:size-3.5">
                  {isHidden ? <EyeOff /> : <Eye />}
                </span>
              </button>
              <button
                type="button"
                className={cn(
                  'p-0.5 text-muted-foreground hover:text-foreground [&_svg]:size-3.5',
                  isHl ? 'text-primary' : 'opacity-0 group-hover:opacity-100',
                )}
                onClick={() => onHighlight(isHl ? null : st.key)}
                title={isHl ? 'Снять подсветку' : 'Подсветить: остальные блоки станут полупрозрачными'}
                aria-label="Подсветить"
              >
                <Crosshair />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
