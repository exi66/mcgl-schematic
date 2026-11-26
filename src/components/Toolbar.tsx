import {
  Activity,
  Box,
  Check,
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
  Trash2,
  Upload,
} from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HexColorPicker } from 'react-colorful';
import { cn } from '@/lib/utils';
import { BUILTIN_HD_PACK, type TexturePackMeta } from '@/lib/texturepacks';
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
  texturePacks,
  activePackId,
  onSelectPack,
  onUploadPack,
  onDeletePack,
}: {
  display: DisplayState;
  onDisplay: (d: DisplayState) => void;
  onReset: () => void;
  showFps: boolean;
  onShowFps: (v: boolean) => void;
  hoverTips: boolean;
  onHoverTips: (v: boolean) => void;
  texturePacks: TexturePackMeta[];
  activePackId: string | null;
  onSelectPack: (id: string | null) => void;
  onUploadPack: (file: File) => void;
  onDeletePack: (id: string) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const bg = display.background ?? themeBackground(display.dark);
  return (
    <>
      <MenuTitle>{t('toolbar.display')}</MenuTitle>
      <button type="button" className={rowClass} onClick={onReset}>
        <RowContent icon={<RotateCcw />} label={t('toolbar.reset')} hotkey="R" />
      </button>
      <MenuSwitch
        icon={<Grid3x3 />}
        label={t('toolbar.grid')}
        hotkey="G"
        checked={display.grid}
        onChange={(grid) => onDisplay({ ...display, grid })}
      />
      <MenuSwitch
        icon={<Compass />}
        label={t('toolbar.labels')}
        checked={display.labels}
        onChange={(labels) => onDisplay({ ...display, labels })}
      />
      <MenuSwitch
        icon={<Box />}
        label={t('toolbar.ortho')}
        hotkey="O"
        checked={display.ortho}
        onChange={(ortho) => onDisplay({ ...display, ortho })}
      />
      <MenuSwitch
        icon={<Sparkles />}
        label={t('toolbar.animate')}
        checked={display.animate}
        onChange={(animate) => onDisplay({ ...display, animate })}
      />
      <MenuSwitch icon={<MousePointer2 />} label={t('toolbar.hoverTips')} checked={hoverTips} onChange={onHoverTips} />
      <MenuSwitch icon={<Activity />} label={t('toolbar.fps')} checked={showFps} onChange={onShowFps} />
      <div className="my-1.5 h-px bg-border" />
      <div className="flex items-center justify-between pr-1">
        <MenuTitle>{t('toolbar.background')}</MenuTitle>
        {display.background !== null && (
          <button
            type="button"
            className="text-[10.5px] text-muted-foreground hover:text-foreground"
            onClick={() => onDisplay({ ...display, background: null })}
          >
            {t('toolbar.themeBackground')}
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
      <div className="my-1.5 h-px bg-border" />
      <MenuTitle>{t('texturepack.title')}</MenuTitle>
      <div className="flex flex-col gap-0.5 pb-1">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-muted/60"
          onClick={() => onSelectPack(null)}
        >
          <span className="inline-flex w-3.5 shrink-0 text-primary [&_svg]:size-3.5">
            {activePackId === null && <Check />}
          </span>
          <span className="flex-1 truncate">{t('texturepack.default')}</span>
        </button>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-muted/60"
          onClick={() => onSelectPack(BUILTIN_HD_PACK.id)}
        >
          <span className="inline-flex w-3.5 shrink-0 text-primary [&_svg]:size-3.5">
            {activePackId === BUILTIN_HD_PACK.id && <Check />}
          </span>
          <span className="flex-1 truncate">{t('texturepack.hd')}</span>
        </button>
        {texturePacks.map((p) => (
          <div
            key={p.id}
            className="group flex items-center gap-1 px-2 py-1 text-[12px] transition-colors hover:bg-muted/60"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
              onClick={() => onSelectPack(p.id)}
              title={`${p.name} (${p.width}×${p.height})`}
            >
              <span className="inline-flex w-3.5 shrink-0 text-primary [&_svg]:size-3.5">
                {activePackId === p.id && <Check />}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-[10.5px] text-muted-foreground tabular-nums">
                {p.width}×{p.height}
              </span>
            </button>
            <button
              type="button"
              className="p-0.5 text-muted-foreground hover:text-destructive [&_svg]:size-3"
              onClick={() => onDeletePack(p.id)}
              title={t('texturepack.delete')}
              aria-label={t('texturepack.delete')}
            >
              <Trash2 />
            </button>
          </div>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onUploadPack(f);
          }}
        />
        <button
          type="button"
          className="mt-0.5 flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          onClick={() => fileRef.current?.click()}
        >
          <span className="inline-flex w-3.5 shrink-0 [&_svg]:size-3.5">
            <Upload />
          </span>
          <span>{t('texturepack.upload')}</span>
        </button>
      </div>
    </>
  );
}

/** Labels: toolbar.modes.<value>.label / .short in the messages. */
const NAV_MODES: { value: NavMode; hotkey: string; icon: ReactNode }[] = [
  { value: 'orbit', hotkey: '1', icon: <Rotate3d /> },
  { value: 'plan', hotkey: '2', icon: <Map /> },
  { value: 'explore', hotkey: '3', icon: <Footprints /> },
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
  texturePacks,
  activePackId,
  onSelectPack,
  onUploadPack,
  onDeletePack,
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
  texturePacks: TexturePackMeta[];
  activePackId: string | null;
  onSelectPack: (id: string | null) => void;
  onUploadPack: (file: File) => void;
  onDeletePack: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-auto flex items-center border bg-card/95 p-1 shadow-lg backdrop-blur">
      <ToolbarModes navMode={navMode} onNavMode={onNavMode} />
      <Sep />
      <Tip content={tipText(t('toolbar.slice'), 'L')}>
        <Toggle aria-label={t('toolbar.slice')} pressed={slice} onPressedChange={() => onSlice()} className={toolClass}>
          <Layers />
        </Toggle>
      </Tip>
      <Tip content={tipText(t('toolbar.measureTip'), '⇧ drag')}>
        <Toggle
          aria-label={t('toolbar.measure')}
          pressed={measure}
          onPressedChange={() => onMeasure()}
          className={toolClass}
        >
          <Ruler />
        </Toggle>
      </Tip>
      <Popover>
        <Tip content={t('toolbar.display')}>
          <PopoverTrigger
            render={
              <Button variant="ghost" aria-label={t('toolbar.display')} className={cn(toolClass, 'gap-0.5 px-2')} />
            }
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
                texturePacks={texturePacks}
                activePackId={activePackId}
                onSelectPack={onSelectPack}
                onUploadPack={onUploadPack}
                onDeletePack={onDeletePack}
              />
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <Sep />
      <Tip content={tipText(t('toolbar.hotkeys'), '?')}>
        <Button variant="ghost" aria-label={t('toolbar.hotkeys')} onClick={onHelp} className={toolClass}>
          <Keyboard />
        </Button>
      </Tip>
      <Tip content={tipText(fullscreen ? t('toolbar.exitFullscreen') : t('toolbar.fullscreen'), 'F')}>
        <Button variant="ghost" aria-label={t('toolbar.fullscreen')} onClick={onFullscreen} className={toolClass}>
          {fullscreen ? <Minimize /> : <Maximize />}
        </Button>
      </Tip>
    </div>
  );
}

/** Orbit / plan / explore: one of three (shadcn ToggleGroup). */
function ToolbarModes({ navMode, onNavMode }: { navMode: NavMode; onNavMode: (m: NavMode) => void }) {
  const { t } = useTranslation();
  return (
    <ToggleGroup
      value={[navMode]}
      onValueChange={(v) => {
        const mode = v[0] as NavMode | undefined;
        if (mode) onNavMode(mode);
      }}
    >
      {NAV_MODES.map((m) => (
        <Tip key={m.value} content={tipText(t(`toolbar.modes.${m.value}.label`), m.hotkey)}>
          <ToggleGroupItem
            value={m.value}
            aria-label={t(`toolbar.modes.${m.value}.label`)}
            className={cn(toolClass, 'aria-pressed:bg-primary aria-pressed:text-primary-foreground')}
          >
            {m.icon} <span className="hidden sm:inline">{t(`toolbar.modes.${m.value}.short`)}</span>
          </ToggleGroupItem>
        </Tip>
      ))}
    </ToggleGroup>
  );
}
