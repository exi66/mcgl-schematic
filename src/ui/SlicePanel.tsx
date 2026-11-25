import { Eye, EyeOff, X } from 'lucide-react';
import type { Axis, SliceState } from '../render/viewer';
import { cn, Slider, Tip } from './kit';

/** Slice panel. Layers are shown 1-based (layer 1 = the bottom row of blocks), as in shulkr. */
export function SlicePanel({
  slice,
  size,
  onChange,
  onClose,
}: {
  slice: SliceState;
  size: { x: number; y: number; z: number };
  onChange: (s: SliceState) => void;
  onClose: () => void;
}) {
  const count = size[slice.axis];
  const set = (value: number) => onChange({ ...slice, value: Math.max(0, Math.min(count - 1, value)) });
  return (
    <div className="pointer-events-auto flex w-[92px] flex-col items-stretch gap-2 border bg-card/95 p-1.5 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-1 border bg-muted p-0.5" role="radiogroup" aria-label="Ось среза">
          {(['x', 'y', 'z'] as Axis[]).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={slice.axis === a}
              title={a === 'y' ? 'Срез по Y (слои)' : `Срез по ${a.toUpperCase()}`}
              onClick={() => onChange({ ...slice, axis: a, value: size[a] - 1 })}
              className={cn('h-6 flex-1 text-[11px] font-semibold uppercase', slice.axis === a ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl leading-none font-semibold tabular-nums">{slice.value + 1}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">из {count}</div>
      </div>
      <div className="flex h-48 justify-center">
        <Slider orientation="vertical" min={0} max={Math.max(0, count - 1)} step={1} value={[slice.value]} onValueChange={([v]) => set(v)} aria-label="Положение среза" />
      </div>
      <div className="flex gap-1">
        <Tip content="Предыдущий слой [">
          <button type="button" className="h-7 flex-1 border text-sm hover:bg-muted" onClick={() => set(slice.value - 1)} aria-label="Предыдущий слой">
            [
          </button>
        </Tip>
        <Tip content="Следующий слой ]">
          <button type="button" className="h-7 flex-1 border text-sm hover:bg-muted" onClick={() => set(slice.value + 1)} aria-label="Следующий слой">
            ]
          </button>
        </Tip>
      </div>
      <Tip content={slice.isolate ? 'Показывать всё до среза (I)' : 'Только этот слой, под ним — подложка (I)'}>
        <button
          type="button"
          aria-pressed={slice.isolate}
          aria-label="Изолировать слой"
          className={cn('flex h-7 items-center justify-center border [&_svg]:size-4', slice.isolate ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          onClick={() => onChange({ ...slice, isolate: !slice.isolate })}
        >
          {slice.isolate ? <EyeOff /> : <Eye />}
        </button>
      </Tip>
      <Tip content="Закрыть срез (L)">
        <button type="button" aria-label="Закрыть срез" className="flex h-7 items-center justify-center border text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4" onClick={onClose}>
          <X />
        </button>
      </Tip>
    </div>
  );
}
