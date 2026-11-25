import { Activity, Box, MousePointer2, ChevronUp, Compass, Footprints, Grid3x3, Keyboard, Layers, Map, Maximize, Minimize, Palette, Rotate3d, RotateCcw, Ruler, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { HexColorPicker } from 'react-colorful';
import type { DisplayState, NavMode } from '../render/viewer';
import { cn, Kbd, Popover, PopoverContent, PopoverTrigger, ScrollArea, Tip } from './kit';

/** Background presets (as in shulkr). */
export const BACKGROUND_PRESETS = ['#000000', '#f4f3ee', '#16233a', '#123a35', '#3a1f2e', '#00b140'];
export const themeBackground = (dark: boolean) => (dark ? '#16181d' : '#dfe3ea');

function ToolButton({ active, onClick, label, hotkey, children, wide }: { active?: boolean; onClick?: () => void; label: string; hotkey?: string; children: ReactNode; wide?: boolean }) {
  return (
    <Tip content={<span>{label}{hotkey && <span className="ml-1.5 opacity-60">{hotkey}</span>}</span>}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-1.5 text-sm font-medium transition-colors [&_svg]:size-4',
          wide ? 'px-3' : 'w-9',
          active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
        )}
      >
        {children}
      </button>
    </Tip>
  );
}

const Sep = () => <span className="mx-1 h-6 w-px bg-border" />;

function MenuTitle({ children }: { children: ReactNode }) {
  return <div className="px-2 pt-1.5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{children}</div>;
}

/** Menu row: icon, label, then fixed columns for the hotkey and the switch (aligned across rows). */
function MenuRow({ icon, label, hotkey, control, ...rest }: { icon: ReactNode; label: string; hotkey?: string; control?: ReactNode } & React.ComponentProps<'button'>) {
  return (
    <button type="button" className="grid w-full grid-cols-[14px_1fr_28px_30px] items-center gap-2.5 p-2 text-left text-[12.5px] transition-colors hover:bg-muted/60" {...rest}>
      <span className="inline-flex text-muted-foreground [&_svg]:size-3.5">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
      <span className="flex justify-end">{hotkey && <Kbd>{hotkey}</Kbd>}</span>
      <span className="flex justify-end">{control}</span>
    </button>
  );
}

function MenuSwitch({ icon, label, hotkey, checked, onChange }: { icon: ReactNode; label: string; hotkey?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <MenuRow
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      icon={icon}
      label={label}
      hotkey={hotkey}
      control={
        <span aria-hidden className={cn('relative h-[17px] w-[30px] shrink-0 transition-colors', checked ? 'bg-primary' : 'bg-input')}>
          <span className={cn('absolute top-0.5 size-[13px] bg-card transition-[left]', checked ? 'left-[15px]' : 'left-0.5')} />
        </span>
      }
    />
  );
}

function DisplayMenu({ display, onDisplay, onReset, showFps, onShowFps, hoverTips, onHoverTips }: { display: DisplayState; onDisplay: (d: DisplayState) => void; onReset: () => void; showFps: boolean; onShowFps: (v: boolean) => void; hoverTips: boolean; onHoverTips: (v: boolean) => void }) {
  const bg = display.background ?? themeBackground(display.dark);
  return (
    <>
      <MenuTitle>Отображение</MenuTitle>
      <MenuRow icon={<RotateCcw />} label="Сбросить вид" hotkey="R" onClick={onReset} />
      <MenuSwitch icon={<Grid3x3 />} label="Сетка на полу" hotkey="G" checked={display.grid} onChange={(grid) => onDisplay({ ...display, grid })} />
      <MenuSwitch icon={<Compass />} label="Подписи сторон ±X ±Z" checked={display.labels} onChange={(labels) => onDisplay({ ...display, labels })} />
      <MenuSwitch icon={<Box />} label="Ортографическая камера" hotkey="O" checked={display.ortho} onChange={(ortho) => onDisplay({ ...display, ortho })} />
      <MenuSwitch icon={<Sparkles />} label="Анимация текстур" checked={display.animate} onChange={(animate) => onDisplay({ ...display, animate })} />
      <MenuSwitch icon={<MousePointer2 />} label="Подсказка при наведении" checked={hoverTips} onChange={onHoverTips} />
      <MenuSwitch icon={<Activity />} label="Счётчик FPS" checked={showFps} onChange={onShowFps} />
      <div className="my-1.5 h-px bg-border" />
      <div className="flex items-center justify-between pr-1">
        <MenuTitle>Фон</MenuTitle>
        {display.background !== null && (
          <button type="button" className="text-[10.5px] text-muted-foreground hover:text-foreground" onClick={() => onDisplay({ ...display, background: null })}>
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
              className={cn('h-6 flex-1 border transition', display.background === c ? 'border-primary ring-1 ring-primary ring-inset' : 'border-input hover:border-foreground/40')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <HexColorPicker className="viewer-color-picker" color={bg} onChange={(c) => onDisplay({ ...display, background: c })} />
        <div className="mt-1.5 text-center text-[10.5px] text-muted-foreground uppercase">{bg}</div>
      </div>
    </>
  );
}

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
      <ToolButton wide active={navMode === 'orbit'} onClick={() => onNavMode('orbit')} label="Вращение" hotkey="1">
        <Rotate3d /> <span className="hidden sm:inline">Вращение</span>
      </ToolButton>
      <ToolButton wide active={navMode === 'plan'} onClick={() => onNavMode('plan')} label="План (вид сверху)" hotkey="2">
        <Map /> <span className="hidden sm:inline">План</span>
      </ToolButton>
      <ToolButton wide active={navMode === 'explore'} onClick={() => onNavMode('explore')} label="Обзор: ходьба и полёт" hotkey="3">
        <Footprints /> <span className="hidden sm:inline">Обзор</span>
      </ToolButton>
      <Sep />
      <ToolButton active={slice} onClick={onSlice} label="Срез" hotkey="L">
        <Layers />
      </ToolButton>
      <ToolButton active={measure} onClick={onMeasure} label="Линейка: протяните по блокам (или Shift + перетаскивание)" hotkey="⇧ drag">
        <Ruler />
      </ToolButton>
      <Popover>
        <Tip content="Отображение">
          <PopoverTrigger asChild>
            <button type="button" aria-label="Отображение" className="inline-flex h-9 items-center gap-0.5 px-2 hover:bg-muted data-[state=open]:bg-muted [&_svg]:size-4">
              <Palette />
              <ChevronUp className="!size-3 opacity-60" />
            </button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent side="top" collisionPadding={8} className="w-max p-0">
          {/* Scrolls only when the menu does not fit on the screen. */}
          <ScrollArea viewportClassName="max-h-[calc(var(--radix-popover-content-available-height)-2px)] overscroll-contain">
            <div className="p-2">
              <DisplayMenu display={display} onDisplay={onDisplay} onReset={onReset} showFps={showFps} onShowFps={onShowFps} hoverTips={hoverTips} onHoverTips={onHoverTips} />
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <Sep />
      <ToolButton onClick={onHelp} label="Горячие клавиши" hotkey="?">
        <Keyboard />
      </ToolButton>
      <ToolButton onClick={onFullscreen} label={fullscreen ? 'Выйти из полноэкранного режима' : 'Полный экран'} hotkey="F">
        {fullscreen ? <Minimize /> : <Maximize />}
      </ToolButton>
    </div>
  );
}
