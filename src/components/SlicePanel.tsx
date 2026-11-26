import { Eye, EyeOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const count = size[slice.axis];
  const set = (value: number) => onChange({ ...slice, value: Math.max(0, Math.min(count - 1, value)) });
  return (
    <div className="pointer-events-auto flex w-[96px] flex-col items-stretch gap-2 border bg-card/95 p-1.5 shadow-lg backdrop-blur">
      <ToggleGroup
        aria-label={t('slice.axis')}
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
            title={a === 'y' ? t('slice.byY') : t('slice.byAxis', { axis: a.toUpperCase() })}
            className={`${small} aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
          >
            {a}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="text-center">
        <div className="text-2xl leading-none font-semibold tabular-nums">{slice.value + 1}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{t('slice.of', { count })}</div>
      </div>
      <div className="flex h-48 justify-center">
        <Slider
          orientation="vertical"
          min={0}
          max={Math.max(0, count - 1)}
          step={1}
          value={slice.value}
          onValueChange={(v) => set(Array.isArray(v) ? v[0] : (v as number))}
          aria-label={t('slice.position')}
        />
      </div>
      <div className="flex gap-1">
        <Tip content={`${t('slice.prev')} [`}>
          <Button variant="outline" className={small} onClick={() => set(slice.value - 1)} aria-label={t('slice.prev')}>
            [
          </Button>
        </Tip>
        <Tip content={`${t('slice.next')} ]`}>
          <Button variant="outline" className={small} onClick={() => set(slice.value + 1)} aria-label={t('slice.next')}>
            ]
          </Button>
        </Tip>
      </div>
      <Tip content={`${slice.isolate ? t('slice.showAll') : t('slice.isolateTip')} (I)`}>
        <Toggle
          variant="outline"
          aria-label={t('slice.isolate')}
          pressed={slice.isolate}
          onPressedChange={(isolate) => onChange({ ...slice, isolate })}
          className={`${small} aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
        >
          {slice.isolate ? <EyeOff /> : <Eye />}
        </Toggle>
      </Tip>
      <Tip content={`${t('slice.close')} (L)`}>
        <Button variant="outline" className={small} aria-label={t('slice.close')} onClick={onClose}>
          <X />
        </Button>
      </Tip>
    </div>
  );
}
