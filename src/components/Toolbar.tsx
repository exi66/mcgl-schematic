import {
  Activity,
  Box,
  ChevronUp,
  Compass,
  Footprints,
  Grid3x3,
  Keyboard,
  Layers,
  Map,
  Maximize,
  Minimize,
  MousePointer2,
  Palette,
  Rotate3d,
  RotateCcw,
  Ruler,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { HexColorPicker } from 'react-colorful';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DisplayState, NavMode } from '../render/viewer';
import { Tip } from './Tip';

/** Background presets (as in shulkr). */
export const BACKGROUND_PRESETS = ['#000000', '#f4f3ee', '#16233a', '#123a35', '#3a1f2e', '#00b140'];
export const themeBackground = (dark: boolean) => (dark ? '#16181d' : '#dfe3ea');

/** Tooltip text with the hotkey. */
const tipText = (label: string, hotkey?: string) => (
  <span>
    {label}
    {hotkey && <span className="ml-1.5 opacity-60">{hotkey}</span>}
  </span>
);

const Sep = () => <span className="mx-1 h-6 w-px bg-border" />;

/** Compact toolbar sizing on top of the shadcn defaults. */
const toolClass =
  'h-9 min-w-9 px-2.5 aria-pressed:bg-primary aria-pressed:text-primary-foreground [&_svg:not([class*=size-])]:size-4';

function MenuTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-1.5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </div>
  );
}

const rowClass =
  'grid w-full cursor-pointer grid-cols-[14px_1fr_28px_34px] items-center gap-2.5 p-2 text-left text-[12.5px] transition-colors hover:bg-muted/60';

function RowContent({
  icon,
  label,
  hotkey,
  control,
}: {
  icon: ReactNode;
  label: string;
  hotkey?: string;
  control?: ReactNode;
}) {
  return (
    <>
      <span className="inline-flex text-muted-foreground [&_svg]:size-3.5">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
      <span className="flex justify-end">{hotkey && <Kbd>{hotkey}</Kbd>}</span>
      <span className="flex justify-end">{control}</span>
    </>
  );
}

/** Menu row with a switch: icon, label, then fixed columns for the hotkey and the switch (aligned across rows). */
function MenuSwitch({
  icon,
  label,
  hotkey,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  hotkey?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={rowClass}>
      <RowContent
        icon={icon}
        label={label}
        hotkey={hotkey}
        control={<Switch checked={checked} onCheckedChange={(v) => onChange(v)} />}
      />
    </label>
  );
}

function DisplayMenu({
  display,
  onDisplay,
  onReset,
  showFps,
  onShowFps,
  hoverTips,
  onHoverTips,
}: {
  display: DisplayState;
  onDisplay: (d: DisplayState) => void;
  onReset: () => void;
  showFps: boolean;
  onShowFps: (v: boolean) => void;
  hoverTips: boolean;
  onHoverTips: (v: boolean) => void;
}) {
  const bg = display.background ?? themeBackground(display.dark);
  return (
    <>
      <MenuTitle>Отображение</MenuTitle>
      <button type="button" className={rowClass} onClick={onReset}>
        <RowContent icon={<RotateCcw />} label="Сбросить вид" hotkey="R" />
      </button>
      <MenuSwitch
        icon={<Grid3x3 />}
        label="Сетка на полу"
        hotkey="G"
        checked={display.grid}
        onChange={(grid) => onDisplay({ ...display, grid })}
      />
      <MenuSwitch
        icon={<Compass />}
        label="Подписи сторон ±X ±Z"
        checked={display.labels}
        onChange={(labels) => onDisplay({ ...display, labels })}
      />
      <MenuSwitch
        icon={<Box />}
        label="Ортографическая камера"
        hotkey="O"
        checked={display.ortho}
        onChange={(ortho) => onDisplay({ ...display, ortho })}
      />
      <MenuSwitch
        icon={<Sparkles />}
        label="Анимация текстур"
        checked={display.animate}
        onChange={(animate) => onDisplay({ ...display, animate })}
      />
      <MenuSwitch icon={<MousePointer2 />} label="Подсказка при наведении" checked={hoverTips} onChange={onHoverTips} />
      <MenuSwitch icon={<Activity />} label="Счётчик FPS" checked={showFps} onChange={onShowFps} />
      <div className="my-1.5 h-px bg-border" />
      <div className="flex items-center justify-between pr-1">
        <MenuTitle>Фон</MenuTitle>
        {display.background !== null && (
          <button
            type="button"
            className="text-[10.5px] text-muted-foreground hover:text-foreground"
            onClick={() => onDisplay({ ...display, background: null })}
          >
            по теме
          </button>
        )}
      </div>
      <div className="px-1 pb-2">
        <div className="mb-2 flex gap-1">
          {BACKGROUND_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              title={c}
              onClick={() => onDisplay({ ...display, background: c })}
              className={cn(
                'h-6 flex-1 border transition',
                display.background === c
                  ? 'border-primary ring-1 ring-primary ring-inset'
                  : 'border-input hover:border-foreground/40',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <HexColorPicker
          className="viewer-color-picker"
          color={bg}
          onChange={(c) => onDisplay({ ...display, background: c })}
        />
        <div className="mt-1.5 text-center text-[10.5px] text-muted-foreground uppercase">{bg}</div>
      </div>
    </>
  );
}

const NAV_MODES: { value: NavMode; label: string; short: string; hotkey: string; icon: ReactNode }[] = [
  { value: 'orbit', label: 'Вращение', short: 'Вращение', hotkey: '1', icon: <Rotate3d /> },
  { value: 'plan', label: 'План (вид сверху)', short: 'План', hotkey: '2', icon: <Map /> },
  { value: 'explore', label: 'Обзор: ходьба и полёт', short: 'Обзор', hotkey: '3', icon: <Footprints /> },
];

export function Toolbar({
  navMode,
  onNavMode,
  slice,
  onSlice,
  measure,
  onMeasure,
  display,
  onDisplay,
  onReset,
  showFps,
  onShowFps,
  hoverTips,
  onHoverTips,
  onHelp,
  fullscreen,
  onFullscreen,
}: {
  navMode: NavMode;
  onNavMode: (m: NavMode) => void;
  slice: boolean;
  onSlice: () => void;
  measure: boolean;
  onMeasure: () => void;
  display: DisplayState;
  onDisplay: (d: DisplayState) => void;
  onReset: () => void;
  showFps: boolean;
  onShowFps: (v: boolean) => void;
  hoverTips: boolean;
  onHoverTips: (v: boolean) => void;
  onHelp: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
}) {
  return (
    <div className="pointer-events-auto flex items-center border bg-card/95 p-1 shadow-lg backdrop-blur">
      <ToolbarModes navMode={navMode} onNavMode={onNavMode} />
      <Sep />
      <Tip content={tipText('Срез', 'L')}>
        <Toggle aria-label="Срез" pressed={slice} onPressedChange={() => onSlice()} className={toolClass}>
          <Layers />
        </Toggle>
      </Tip>
      <Tip content={tipText('Линейка: протяните по блокам (или Shift + перетаскивание)', '⇧ drag')}>
        <Toggle aria-label="Линейка" pressed={measure} onPressedChange={() => onMeasure()} className={toolClass}>
          <Ruler />
        </Toggle>
      </Tip>
      <Popover>
        <Tip content="Отображение">
          <PopoverTrigger
            render={<Button variant="ghost" aria-label="Отображение" className={cn(toolClass, 'gap-0.5 px-2')} />}
          >
            <Palette />
            <ChevronUp className="size-3! opacity-60" />
          </PopoverTrigger>
        </Tip>
        <PopoverContent side="top" sideOffset={8} className="w-max gap-0 p-0">
          {/* Scrolls only when the menu does not fit on the screen. */}
          <ScrollArea className="max-h-[calc(var(--available-height)-2px)] [&>[data-slot=scroll-area-viewport]]:max-h-[inherit]">
            <div className="p-2">
              <DisplayMenu
                display={display}
                onDisplay={onDisplay}
                onReset={onReset}
                showFps={showFps}
                onShowFps={onShowFps}
                hoverTips={hoverTips}
                onHoverTips={onHoverTips}
              />
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <Sep />
      <Tip content={tipText('Горячие клавиши', '?')}>
        <Button variant="ghost" aria-label="Горячие клавиши" onClick={onHelp} className={toolClass}>
          <Keyboard />
        </Button>
      </Tip>
      <Tip content={tipText(fullscreen ? 'Выйти из полноэкранного режима' : 'Полный экран', 'F')}>
        <Button variant="ghost" aria-label="Полный экран" onClick={onFullscreen} className={toolClass}>
          {fullscreen ? <Minimize /> : <Maximize />}
        </Button>
      </Tip>
    </div>
  );
}

/** Orbit / plan / explore: one of three (shadcn ToggleGroup). */
function ToolbarModes({ navMode, onNavMode }: { navMode: NavMode; onNavMode: (m: NavMode) => void }) {
  return (
    <ToggleGroup
      value={[navMode]}
      onValueChange={(v) => {
        const mode = v[0] as NavMode | undefined;
        if (mode) onNavMode(mode);
      }}
    >
      {NAV_MODES.map((m) => (
        <Tip key={m.value} content={tipText(m.label, m.hotkey)}>
          <ToggleGroupItem
            value={m.value}
            aria-label={m.label}
            className={cn(toolClass, 'aria-pressed:bg-primary aria-pressed:text-primary-foreground')}
          >
            {m.icon} <span className="hidden sm:inline">{m.short}</span>
          </ToggleGroupItem>
        </Tip>
      ))}
    </ToggleGroup>
  );
}
