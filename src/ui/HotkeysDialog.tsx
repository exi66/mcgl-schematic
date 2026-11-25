import type { ReactNode } from 'react';
import { Dialog, Kbd } from './kit';

type Row = [string, ReactNode[]];

const SECTIONS: [string, Row[]][] = [
  [
    'Вид',
    [
      ['Вращение', ['1']],
      ['План (сверху)', ['2']],
      ['Обзор (ходьба / полёт)', ['3']],
      ['Сбросить вид', ['R']],
      ['Срез вкл / выкл', ['L']],
      ['Повернуть вид', ['Q', 'E']],
      ['Орто / перспектива', ['O']],
      ['Сетка на полу', ['G']],
    ],
  ],
  [
    'Срез',
    [
      ['Следующий слой', [']']],
      ['Предыдущий слой', ['[']],
      ['На 10 слоёв', ['⇧', '[', ']']],
      ['Изолировать слой', ['I']],
    ],
  ],
  [
    'Обзор',
    [
      ['Идти / лететь', ['W', 'A', 'S', 'D']],
      ['Прыжок / вверх', ['Space']],
      ['Полёт ↔ ходьба', ['Space', 'Space']],
      ['Присесть (не упасть с края) / вниз', ['⇧']],
      ['Бег (двойное вперёд)', ['W', 'W']],
      ['Скорость полёта', ['Колесо']],
      ['Отпустить мышь', ['Esc']],
    ],
  ],
  [
    'Панели и выделение',
    [
      ['Список блоков', ['M']],
      ['Полный экран', ['F']],
      ['Эта справка', ['?']],
      ['Выбрать блок', ['Клик']],
      ['Измерить область', ['⇧', 'Перетащить']],
      ['Снять выделение', ['Esc']],
    ],
  ],
];

export function HotkeysDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Горячие клавиши" description={<>Нажмите <Kbd>?</Kbd>, чтобы открыть снова.</>}>
      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        {SECTIONS.map(([title, rows]) => (
          <section key={title}>
            <h3 className="mb-3 border-b pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{title}</h3>
            <ul className="flex flex-col gap-1.5 text-sm">
              {rows.map(([label, keys]) => (
                <li key={label} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <span className="flex shrink-0 gap-1">
                    {keys.map((k, i) => (
                      <Kbd key={i}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
