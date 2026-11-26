import { X } from 'lucide-react';
import { type ReactNode, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { blockDef, blockDescription, blockName } from '../blocks/pool';
import type { Cell } from '../render/overlays';
import { Viewer, type DisplayState, type NavMode, type ViewState } from '../render/viewer';
import { blockIndex, type Schematic } from '../schematic/schematic';
import { BlockIcon } from './BlockIcon';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import type { Object3D } from 'three';

export interface ViewportHandle {
  fit(): void;
  rotate(dir: 1 | -1): void;
  /** Clears selection and measurement; returns true if there was something to clear. */
  clear(): boolean;
  /** A plugin's 3D layer (see src/plugins). */
  setOverlay(key: string, object: Object3D | null): void;
}

/** An action for the selected block, offered by a plugin (shown in the block card). */
export interface CardAction {
  key: string;
  label: string;
  icon?: ReactNode;
  run: () => void;
}

interface BlockAt extends Cell {
  id: number;
  meta: number;
}

interface Props {
  schematic: Schematic | null;
  view: ViewState;
  display: DisplayState;
  navMode: NavMode;
  measureMode: boolean;
  showFps: boolean;
  /** Tooltip with the block under the cursor (and under the crosshair in explore). */
  hoverTips: boolean;
  onMeasureDone: () => void;
  /** Explore mode grabbed / released the mouse (the toolbar gives way to the controls hint). */
  onExploreLock: (locked: boolean) => void;
  onError: (msg: string) => void;
  /** Plugin actions for the selected block. */
  blockActions?: (block: BlockAt) => CardAction[];
}

/** Calls fn at most once per animation frame with the latest arguments. */
function useRafThrottle<A extends unknown[]>(fn: (...a: A) => void): (...a: A) => void {
  const frame = useRef(0);
  const args = useRef<A | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return useCallback((...a: A) => {
    args.current = a;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (args.current) fnRef.current(...args.current);
    });
  }, []);
}

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(
  {
    schematic,
    view,
    display,
    navMode,
    measureMode,
    showFps,
    hoverTips,
    onMeasureDone,
    onExploreLock,
    onError,
    blockActions,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const shownRef = useRef<Schematic | null>(null);
  const [hover, setHover] = useState<(BlockAt & { px: number; py: number }) | null>(null);
  const [selected, setSelected] = useState<BlockAt | null>(null);
  const [measure, setMeasure] = useState<{ a: Cell; b: Cell } | null>(null);
  const [locked, setLocked] = useState(false);
  const [, setTick] = useState(0);
  const drag = useRef<{ x: number; y: number; measuring: boolean; a?: Cell; moved: boolean } | null>(null);

  const blockAt = useCallback(
    (c: Cell): BlockAt => {
      const i = blockIndex(schematic!, c.x, c.y, c.z);
      return { ...c, id: schematic!.blocks[i], meta: schematic!.data[i] };
    },
    [schematic],
  );

  const clearAll = useCallback(() => {
    setSelected(null);
    setMeasure(null);
    viewerRef.current?.setSelected(null);
    viewerRef.current?.setMeasure(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fit: () => viewerRef.current?.fit(),
      rotate: (d) => viewerRef.current?.rotateView(d),
      clear: () => {
        const had = selected !== null || measure !== null;
        clearAll();
        return had;
      },
      setOverlay: (key, object) => viewerRef.current?.setPluginOverlay(key, object),
    }),
    [selected, measure, clearAll],
  );

  const bump = useRafThrottle(() => setTick((t) => (t + 1) % 1e6));

  useEffect(() => {
    const v = new Viewer(hostRef.current!);
    viewerRef.current = v;
    if (import.meta.env.DEV) (window as unknown as { __viewer: Viewer }).__viewer = v;
    v.onExploreLock = (l) => setLocked(l);
    v.onCameraChange = () => {
      if (v.navMode === 'explore') bump();
    };
    return () => {
      v.dispose();
      viewerRef.current = null;
      shownRef.current = null;
    };
  }, [bump]);

  useEffect(() => {
    onExploreLock(navMode === 'explore' && locked);
  }, [navMode, locked, onExploreLock]);

  // FPS meter refresh.
  useEffect(() => {
    if (!showFps) return;
    const t = setInterval(() => setTick((x) => (x + 1) % 1e6), 500);
    return () => clearInterval(t);
  }, [showFps]);

  useEffect(() => {
    viewerRef.current?.setDisplay(display);
  }, [display]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !schematic) return;
    const fresh = shownRef.current !== schematic;
    const p = fresh ? v.setSchematic(schematic, view) : v.update(view);
    shownRef.current = schematic;
    p.catch((e: Error) => onError(e.message));
    setHover(null);
    v.setHover(null);
    if (fresh) {
      setSelected(null);
      setMeasure(null);
    }
  }, [schematic, view, onError]);

  useEffect(() => {
    viewerRef.current?.setNavMode(navMode);
    setHover(null);
    viewerRef.current?.setHover(null);
    if (navMode !== 'explore') setLocked(false);
  }, [navMode]);

  const hoverAt = useRafThrottle((clientX: number, clientY: number) => {
    const v = viewerRef.current;
    if (!v || !schematic || drag.current) return;
    const hit = v.pick(clientX, clientY);
    if (!hit) {
      setHover(null);
      v.setHover(null);
      return;
    }
    const rect = hostRef.current!.getBoundingClientRect();
    setHover({ ...blockAt(hit), px: clientX - rect.left, py: clientY - rect.top });
    v.setHover(hit);
  });

  const measureTo = useRafThrottle((clientX: number, clientY: number) => {
    const v = viewerRef.current;
    const d = drag.current;
    if (!v || !d?.a) return;
    const hit = v.pick(clientX, clientY);
    if (hit) {
      setMeasure({ a: d.a, b: hit });
      v.setMeasure(d.a, hit);
    }
  });

  const onPointerDown = (e: React.PointerEvent) => {
    const v = viewerRef.current;
    if (!v || !schematic || e.button !== 0 || navMode === 'explore') return;
    const measuring = e.shiftKey || measureMode;
    drag.current = { x: e.clientX, y: e.clientY, measuring, moved: false };
    if (measuring) {
      const hit = v.pick(e.clientX, e.clientY);
      if (hit) {
        drag.current.a = hit;
        v.setControlsEnabled(false);
        setMeasure({ a: hit, b: hit });
        v.setMeasure(hit, hit);
        setHover(null);
        v.setHover(null);
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
      if (d.measuring && d.a) measureTo(e.clientX, e.clientY);
      return;
    }
    if (navMode !== 'explore') hoverAt(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const v = viewerRef.current;
    const d = drag.current;
    drag.current = null;
    if (!v || !d || !schematic) return;
    v.setControlsEnabled(true);
    if (d.measuring) {
      if (d.a) onMeasureDone();
      return;
    }
    if (d.moved || navMode === 'explore') return;
    // A click: select the block under the cursor.
    const hit = v.pick(e.clientX, e.clientY);
    const sel = hit ? blockAt(hit) : null;
    setSelected(sel);
    v.setSelected(sel);
  };

  const onLeave = useCallback(() => {
    setHover(null);
    viewerRef.current?.setHover(null);
  }, []);

  const v = viewerRef.current;
  const explore = navMode === 'explore';
  const lookAt = hoverTips && explore && locked && schematic ? v?.pick(0, 0) : null;
  const ex = explore ? v?.exploreState() : null;
  const camPos = explore ? v?.cameraPosition() : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={hostRef}
        className={measureMode && !explore ? 'absolute inset-0 cursor-crosshair' : 'absolute inset-0'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
      {schematic && hoverTips && hover && !explore && <HoverCard block={hover} style={hoverStyle(hover)} />}
      {schematic && measure && <MeasureCard a={measure.a} b={measure.b} schematic={schematic} onClose={clearAll} />}
      {schematic && selected && (
        <div className="absolute top-3 right-3 z-10 w-72">
          <InfoCard
            block={selected}
            actions={blockActions?.(selected) ?? []}
            onClose={() => {
              setSelected(null);
              v?.setSelected(null);
            }}
          />
        </div>
      )}
      {showFps && v && (
        <div className="pointer-events-none absolute right-3 bottom-3 z-20 border bg-card/90 px-2.5 py-1.5 text-xs leading-5 tabular-nums shadow-sm backdrop-blur">
          {v.fps} FPS
        </div>
      )}
      {explore && locked && (
        <>
          <div className="pointer-events-none absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 before:absolute before:top-1/2 before:left-0 before:h-0.5 before:w-full before:-translate-y-1/2 before:bg-white/80 after:absolute after:top-0 after:left-1/2 after:h-full after:w-0.5 after:-translate-x-1/2 after:bg-white/80" />
          {ex && camPos && (
            <div className="pointer-events-none absolute top-3 left-3 z-10 border bg-card/90 px-2.5 py-1.5 text-xs leading-5 tabular-nums shadow-sm backdrop-blur">
              {ex.flying ? `Полёт · скорость ${ex.speed.toFixed(0)}` : 'Ходьба'} · {camPos.x.toFixed(1)}{' '}
              {camPos.y.toFixed(1)} {camPos.z.toFixed(1)}
            </div>
          )}
          {hoverTips && lookAt && schematic && (
            <div className="pointer-events-none absolute top-[calc(50%+24px)] left-1/2 z-10 -translate-x-1/2">
              <HoverCard block={blockAt(lookAt)} />
            </div>
          )}
          <ExploreHint flying={ex?.flying ?? true} />
        </>
      )}
      {explore && !locked && (
        <button
          type="button"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 backdrop-blur-[3px]"
          onClick={() => v?.lockExplore()}
        >
          <span className="border bg-card/95 px-7 py-4 text-center shadow-lg">
            <span className="block text-sm font-semibold">Кликните, чтобы осмотреться</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Чтобы выйти из обзора, переключите режим на панели ниже.
            </span>
          </span>
        </button>
      )}
    </div>
  );
});

/** Controls hint shown in place of the toolbar while the explore mode holds the mouse (as in shulkr). */
function ExploreHint({ flying }: { flying: boolean }) {
  const rows: [React.ReactNode, string][] = [
    [
      <>
        <Kbd>W</Kbd>
        <Kbd>A</Kbd>
        <Kbd>S</Kbd>
        <Kbd>D</Kbd>
      </>,
      flying ? 'Лететь' : 'Идти',
    ],
    [<Kbd>Мышь</Kbd>, 'Смотреть'],
    [<Kbd>Space</Kbd>, flying ? 'Вверх' : 'Прыжок'],
    [<Kbd>⇧</Kbd>, flying ? 'Вниз' : 'Присесть'],
    [
      <>
        <Kbd>Space</Kbd>
        <Kbd>Space</Kbd>
      </>,
      flying ? 'Приземлиться' : 'Взлететь',
    ],
    [
      <>
        <Kbd>W</Kbd>
        <Kbd>W</Kbd>
      </>,
      'Бег',
    ],
    ...(flying ? ([[<Kbd>Колесо</Kbd>, 'Скорость полёта']] as [React.ReactNode, string][]) : []),
    [<Kbd>Esc</Kbd>, 'Отпустить мышь'],
  ];
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 max-w-[calc(100%-24px)] -translate-x-1/2 border bg-card/95 px-4 py-2.5 text-xs shadow-lg backdrop-blur">
      <ul className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 lg:flex-nowrap lg:whitespace-nowrap">
        {rows.map(([keys, label]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className="flex gap-0.5">{keys}</span>
            <span className="text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MeasureCard({ a, b, schematic, onClose }: { a: Cell; b: Cell; schematic: Schematic; onClose: () => void }) {
  const x0 = Math.min(a.x, b.x),
    x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y),
    y1 = Math.max(a.y, b.y);
  const z0 = Math.min(a.z, b.z),
    z1 = Math.max(a.z, b.z);
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1,
    l = z1 - z0 + 1;
  let inside = 0;
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) if (schematic.blocks[blockIndex(schematic, x, y, z)] !== 0) inside++;
  const fmt = new Intl.NumberFormat('ru-RU');
  return (
    <div className="absolute top-3 left-3 z-10 w-56 border bg-card/95 text-sm shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-2 border-b px-3 py-2.5">
        <div>
          <div className="font-semibold">
            {w} × {h} × {l}
          </div>
          <div className="text-xs text-muted-foreground">{fmt.format(w * h * l)} клеток</div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="-mr-1 text-muted-foreground"
          onClick={onClose}
          aria-label="Убрать измерение"
        >
          <X />
        </Button>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Блоков внутри</div>
        <div className="mt-0.5">{fmt.format(inside)}</div>
        <div className="mt-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">От — до</div>
        <div className="mt-0.5 text-xs">
          {x0} {y0} {z0} → {x1} {y1} {z1}
        </div>
      </div>
    </div>
  );
}

function hoverStyle(h: { px: number; py: number }): React.CSSProperties {
  const left = Math.min(h.px + 16, (typeof window !== 'undefined' ? window.innerWidth : 1e4) - 320);
  return { position: 'absolute', left: Math.max(8, left), top: h.py + 16 };
}

function HoverCard({ block, style }: { block: BlockAt; style?: React.CSSProperties }) {
  return (
    <div
      className="pointer-events-none z-10 flex max-w-72 items-center gap-2.5 border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
      style={style}
    >
      <BlockIcon id={block.id} meta={block.meta} size={32} />
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-5 font-medium">{blockName(block.id, block.meta)}</div>
        <div className="leading-5 text-muted-foreground tabular-nums">
          ID: {block.id}:{block.meta}
        </div>
        <div className="leading-5 text-muted-foreground tabular-nums">
          Положение: {block.x}, {block.y}, {block.z}
        </div>
        {!blockDef(block.id) && <div className="mt-1 text-muted-foreground">Нет в пуле — показан заглушкой</div>}
      </div>
    </div>
  );
}

function InfoCard({ block, actions, onClose }: { block: BlockAt; actions: CardAction[]; onClose: () => void }) {
  const desc = blockDescription(block.id, block.meta);
  return (
    <div className="border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
      <div className="flex items-center gap-2.5">
        <BlockIcon id={block.id} meta={block.meta} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-5 font-semibold">{blockName(block.id, block.meta)}</div>
          <div className="leading-5 text-muted-foreground tabular-nums">
            ID: {block.id}:{block.meta}
          </div>
          <div className="leading-5 text-muted-foreground tabular-nums">
            Положение: {block.x}, {block.y}, {block.z}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="-mr-1 self-start text-muted-foreground"
          onClick={onClose}
          aria-label="Снять выделение"
        >
          <X />
        </Button>
      </div>
      {desc && <div className="mt-2 leading-relaxed text-muted-foreground">{desc}</div>}
      {!blockDef(block.id) && (
        <div className="mt-2 text-muted-foreground">Блок пока не поддерживается — показан заглушкой.</div>
      )}
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {actions.map((a) => (
            <Button key={a.key} variant="outline" size="xs" onClick={a.run}>
              {a.icon}
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
