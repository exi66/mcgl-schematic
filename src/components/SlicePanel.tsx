import { Eye, EyeOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Axis, SliceState } from '../render/viewer';
import { Tip } from './Tip';

const AXES: Axis[] = ['x', 'y', 'z'];
const small = 'h-7 min-w-0 flex-1 px-0';

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
    <div className="pointer-events-auto flex w-[96px] flex-col items-stretch gap-2 border bg-card/95 p-1.5 shadow-lg backdrop-blur">
      <ToggleGroup
        aria-label="Ось среза"
        variant="outline"
        className="w-full"
        value={[slice.axis]}
        onValueChange={(v) => {
          const axis = v[0] as Axis | undefined;
          if (axis) onChange({ ...slice, axis, value: size[axis] - 1 });
        }}
      >
        {AXES.map((a) => (
          <ToggleGroupItem
            key={a}
            value={a}
            title={a === 'y' ? 'Срез по Y (слои)' : `Срез по ${a.toUpperCase()}`}
            className={`${small} aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
          >
            {a}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="text-center">
        <div className="text-2xl leading-none font-semibold tabular-nums">{slice.value + 1}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">из {count}</div>
      </div>
      <div className="flex h-48 justify-center">
        <Slider
          orientation="vertical"
          min={0}
          max={Math.max(0, count - 1)}
          step={1}
          value={slice.value}
          onValueChange={(v) => set(Array.isArray(v) ? v[0] : (v as number))}
          aria-label="Положение среза"
        />
      </div>
      <div className="flex gap-1">
        <Tip content="Предыдущий слой [">
          <Button variant="outline" className={small} onClick={() => set(slice.value - 1)} aria-label="Предыдущий слой">
            [
          </Button>
        </Tip>
        <Tip content="Следующий слой ]">
          <Button variant="outline" className={small} onClick={() => set(slice.value + 1)} aria-label="Следующий слой">
            ]
          </Button>
        </Tip>
      </div>
      <Tip content={slice.isolate ? 'Показывать всё до среза (I)' : 'Только этот слой, под ним — подложка (I)'}>
        <Toggle
          variant="outline"
          aria-label="Изолировать слой"
          pressed={slice.isolate}
          onPressedChange={(isolate) => onChange({ ...slice, isolate })}
          className={`${small} aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
        >
          {slice.isolate ? <EyeOff /> : <Eye />}
        </Toggle>
      </Tip>
      <Tip content="Закрыть срез (L)">
        <Button variant="outline" className={small} aria-label="Закрыть срез" onClick={onClose}>
          <X />
        </Button>
      </Tip>
    </div>
  );
}
