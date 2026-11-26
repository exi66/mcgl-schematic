import { FolderOpen, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadFromFile, loadFromUrl } from './app/load';
import { readUrlState, shareLink } from './app/url';
import type { DisplayState, NavMode, SliceState, ViewState } from './render/viewer';
import type { Schematic } from './schematic/schematic';
import { BlockList, blockStats } from './components/BlockList';
import { HotkeysDialog } from './components/HotkeysDialog';
import { SlicePanel } from './components/SlicePanel';
import { Toolbar } from './components/Toolbar';
import { ExportMenu } from './components/ExportMenu';
import { OpenDialog } from './components/OpenDialog';
import { Viewport, type CardAction, type ViewportHandle } from './components/Viewport';
import { PLUGINS, type BlockRef, type Plugin, type PluginHost } from './plugins';
import { blockIndex } from './schematic/schematic';
import { Tip } from './components/Tip';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';

const EXAMPLE = `${import.meta.env.BASE_URL}examples/all-blocks.schematic`;
const initial = readUrlState();

function useStored<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      if (s !== null) return JSON.parse(s) as T;
    } catch {
      /* storage unavailable */
    }
    return init;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }, [key, v]);
  return [v, setV];
}

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

export default function App() {
  const [dark, setDark] = useStored('theme-dark', window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [schematic, setSchematic] = useState<Schematic | null>(null);
  const [source, setSource] = useState<{ name: string; url?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navMode, setNavMode] = useState<NavMode>(initial.view ?? 'orbit');
  const [slice, setSlice] = useState<SliceState>({ enabled: false, axis: 'y', value: 0, isolate: false });
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);
  const [grid, setGrid] = useStored('grid', true);
  const [ortho, setOrtho] = useStored('ortho', false);
  const [background, setBackground] = useStored<string | null>('background', null);
  const [animate, setAnimate] = useStored('animate', true);
  const [labels, setLabels] = useStored('labels', true);
  const [showFps, setShowFps] = useStored('fps', false);
  const [hoverTips, setHoverTips] = useStored('hover-tips', false);
  const [sidebar, setSidebar] = useStored('sidebar', true);
  const [measureMode, setMeasureMode] = useState(false);
  const [exploreLocked, setExploreLocked] = useState(false);
  const [help, setHelp] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const viewportRef = useRef<ViewportHandle>(null);
  /** The plugin panel opened by a block action (src/plugins). */
  const [pluginRun, setPluginRun] = useState<{ plugin: Plugin; block: BlockRef; action: string } | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const open = useCallback(async (job: () => Promise<Schematic>, src: { name: string; url?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const s = await job();
      setSchematic(s);
      setSource(src);
      setHidden(new Set());
      setHighlight(null);
      const fromLink = firstLoad.current ? initial.slice : undefined;
      if (fromLink) {
        const size = { x: s.width, y: s.height, z: s.length }[fromLink.axis];
        setSlice({ enabled: true, ...fromLink, value: Math.min(fromLink.value, size - 1) });
      } else {
        setSlice({ enabled: false, axis: 'y', value: s.height - 1, isolate: false });
      }
      firstLoad.current = false;
      if (s.warnings.length) setError(s.warnings.join('\n'));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const openUrl = useCallback(
    (url: string) => {
      const name = decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || url);
      return open(() => loadFromUrl(url), { name, url });
    },
    [open],
  );
  const openFile = useCallback((f: File) => open(() => loadFromFile(f), { name: f.name }), [open]);

  useEffect(() => {
    if (initial.url) void openUrl(initial.url);
  }, [openUrl]);

  // Keep ?url= and the view in the address bar for remote files.
  useEffect(() => {
    const link = shareLink(source?.url, navMode === 'plan' ? 'plan' : 'orbit', slice);
    if (link) window.history.replaceState(null, '', link);
  }, [source, navMode, slice]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  const size = useMemo(
    () => (schematic ? { x: schematic.width, y: schematic.height, z: schematic.length } : { x: 1, y: 1, z: 1 }),
    [schematic],
  );

  const toggleSlice = useCallback(
    () =>
      setSlice((s) => ({
        ...s,
        enabled: !s.enabled,
        value: s.enabled ? s.value : Math.min(s.value, size[s.axis] - 1),
      })),
    [size],
  );
  const stepSlice = useCallback(
    (d: number) =>
      setSlice((s) => ({ ...s, enabled: true, value: Math.max(0, Math.min(size[s.axis] - 1, s.value + d)) })),
    [size],
  );

  // Hotkeys (as in shulkr).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!schematic) return;
      const exploring = navMode === 'explore' && document.pointerLockElement !== null;
      const k = e.key;
      if (k === '1') setNavMode('orbit');
      else if (k === '2') setNavMode('plan');
      else if (k === '3') setNavMode('explore');
      else if (exploring) return;
      else if (k === 'r' || k === 'R' || k === 'к' || k === 'К') viewportRef.current?.fit();
      else if (e.code === 'KeyL') toggleSlice();
      else if (e.code === 'KeyQ') viewportRef.current?.rotate(-1);
      else if (e.code === 'KeyE') viewportRef.current?.rotate(1);
      else if (e.code === 'KeyO') setOrtho((o) => !o);
      else if (e.code === 'KeyG') setGrid((g) => !g);
      else if (e.code === 'BracketRight') stepSlice(e.shiftKey ? 10 : 1);
      else if (e.code === 'BracketLeft') stepSlice(e.shiftKey ? -10 : -1);
      else if (e.code === 'KeyI') setSlice((s) => ({ ...s, enabled: true, isolate: !s.isolate }));
      else if (e.code === 'KeyM') setSidebar((v) => !v);
      else if (e.code === 'KeyF') toggleFullscreen();
      else if (k === '?' || (e.code === 'Slash' && e.shiftKey)) setHelp((h) => !h);
      else if (k === 'Escape') {
        if (!viewportRef.current?.clear()) setMeasureMode(false);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [schematic, navMode, toggleSlice, stepSlice, setOrtho, setGrid, setSidebar, toggleFullscreen]);

  const stats = useMemo(() => (schematic ? blockStats(schematic) : []), [schematic]);
  const nonAir = useMemo(() => stats.reduce((a, s) => a + s.count, 0), [stats]);
  const materials = useMemo(
    () => ({
      fileName: source?.name ?? 'schematic',
      size,
      rows: stats.map((s) => ({ count: s.count, key: s.key, name: s.name })),
    }),
    [source, size, stats],
  );
  const view: ViewState = useMemo(() => ({ slice, hidden, highlight }), [slice, hidden, highlight]);
  const display: DisplayState = useMemo(
    () => ({ grid, ortho, background, dark, animate, labels }),
    [grid, ortho, background, dark, animate, labels],
  );
  const onError = useCallback((m: string) => setError(m), []);

  const makeHost = useCallback(
    (plugin: Plugin): PluginHost | null =>
      schematic && {
        schematic,
        block: (x, y, z) => {
          if (x < 0 || y < 0 || z < 0 || x >= schematic.width || y >= schematic.height || z >= schematic.length)
            return { id: 0, meta: 0 };
          const i = blockIndex(schematic, x, y, z);
          return { id: schematic.blocks[i], meta: schematic.data[i] };
        },
        setOverlay: (object) => viewportRef.current?.setOverlay(plugin.id, object),
      },
    [schematic],
  );

  const blockActions = useCallback(
    (block: BlockRef): CardAction[] =>
      PLUGINS.flatMap((plugin) => {
        const host = makeHost(plugin);
        if (!host || !plugin.blockActions) return [];
        return plugin.blockActions(block, host).map((a) => ({
          key: `${plugin.id}:${a.id}`,
          label: a.label,
          icon: a.icon,
          run: () => setPluginRun({ plugin, block, action: a.id }),
        }));
      }),
    [makeHost],
  );

  const closePlugin = useCallback(() => {
    if (pluginRun) viewportRef.current?.setOverlay(pluginRun.plugin.id, null);
    setPluginRun(null);
  }, [pluginRun]);

  // A new schematic closes the plugin panel (its layer belongs to the old one).
  useEffect(() => {
    setPluginRun(null);
  }, [schematic]);

  const fmt = new Intl.NumberFormat('ru-RU');

  return (
    <TooltipProvider delay={300}>
      <div
        className="flex h-full flex-col"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void openFile(f);
        }}
      >
        {!fullscreen && (
          <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              {schematic && (
                <Tip content={sidebar ? 'Скрыть список блоков (M)' : 'Показать список блоков (M)'}>
                  <Button variant="ghost" size="icon" onClick={() => setSidebar((v) => !v)} aria-label="Список блоков">
                    {sidebar ? <PanelLeftClose /> : <PanelLeftOpen />}
                  </Button>
                </Tip>
              )}
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-6" />
              <h1 className="text-base font-semibold tracking-tight">Схематики MCGL</h1>
            </div>
            {schematic && source && (
              <div className="flex min-w-0 items-baseline gap-2 text-sm">
                <span className="truncate font-medium" title={source.url ?? source.name}>
                  {source.name}
                </span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpenDialog(true)} disabled={loading}>
                <FolderOpen /> Открыть
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDark((d) => !d)}
                title={dark ? 'Светлая тема' : 'Тёмная тема'}
                aria-label="Сменить тему"
              >
                {dark ? <Sun /> : <Moon />}
              </Button>
            </div>
          </header>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm whitespace-pre-line text-destructive"
          >
            <span className="flex-1">{error}</span>
            <Button variant="link" size="xs" className="h-auto p-0 text-destructive" onClick={() => setError(null)}>
              закрыть
            </Button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
          {schematic && sidebar && !fullscreen && (
            <aside className="flex max-h-[38vh] w-full shrink-0 flex-col overflow-hidden border-t bg-sidebar md:max-h-none md:w-80 md:border-t-0 md:border-r">
              <div className="flex items-center gap-3 px-3 pt-3 pb-1">
                <h2 className="flex-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Блоки</h2>
                <ExportMenu list={materials} />
                {(hidden.size > 0 || highlight !== null) && (
                  <Button
                    variant="link"
                    size="xs"
                    className="-my-1 px-0"
                    onClick={() => {
                      setHidden(new Set());
                      setHighlight(null);
                    }}
                  >
                    показать все
                  </Button>
                )}
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="px-1.5 pb-3">
                  <BlockList
                    stats={stats}
                    hidden={hidden}
                    highlight={highlight}
                    onToggleHidden={(id) =>
                      setHidden((h) => {
                        const n = new Set(h);
                        if (n.has(id)) n.delete(id);
                        else n.add(id);
                        return n;
                      })
                    }
                    onHighlight={setHighlight}
                  />
                </div>
              </ScrollArea>
            </aside>
          )}
          <main className="relative min-h-0 min-w-0 flex-1">
            <Viewport
              ref={viewportRef}
              schematic={schematic}
              view={view}
              display={display}
              navMode={navMode}
              measureMode={measureMode}
              showFps={showFps}
              hoverTips={hoverTips}
              onMeasureDone={() => setMeasureMode(false)}
              onExploreLock={setExploreLocked}
              onError={onError}
              blockActions={blockActions}
            />
            {schematic && (
              <>
                <div className="pointer-events-none absolute bottom-3 left-3 z-10 border bg-card/90 px-2.5 py-1.5 text-xs leading-5 tabular-nums shadow-sm backdrop-blur">
                  <div>
                    {schematic.width} × {schematic.height} × {schematic.length}
                  </div>
                  <div>{fmt.format(nonAir)} блоков</div>
                  {slice.enabled && (
                    <div className="text-primary">
                      {slice.isolate ? 'Слой' : 'До слоя'} {slice.axis.toUpperCase()} {slice.value + 1} из{' '}
                      {size[slice.axis]}
                    </div>
                  )}
                </div>
                {navMode !== 'explore' && slice.enabled && (
                  <div className="absolute top-1/2 right-3 z-10 -translate-y-1/2">
                    <SlicePanel
                      slice={slice}
                      size={size}
                      onChange={setSlice}
                      onClose={() => setSlice((s) => ({ ...s, enabled: false }))}
                    />
                  </div>
                )}
                <div
                  className={cn(
                    'pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2',
                    exploreLocked && 'hidden',
                  )}
                >
                  <Toolbar
                    navMode={navMode}
                    onNavMode={setNavMode}
                    slice={slice.enabled}
                    onSlice={toggleSlice}
                    measure={measureMode}
                    onMeasure={() => setMeasureMode((m) => !m)}
                    display={display}
                    onDisplay={(d) => {
                      setGrid(d.grid);
                      setOrtho(d.ortho);
                      setBackground(d.background);
                      setAnimate(d.animate);
                      setLabels(d.labels);
                    }}
                    onReset={() => viewportRef.current?.fit()}
                    showFps={showFps}
                    onShowFps={setShowFps}
                    hoverTips={hoverTips}
                    onHoverTips={setHoverTips}
                    onHelp={() => setHelp(true)}
                    fullscreen={fullscreen}
                    onFullscreen={toggleFullscreen}
                  />
                </div>
              </>
            )}
            {pluginRun && pluginRun.plugin.Panel && makeHost(pluginRun.plugin) && (
              <div className="absolute top-3 left-3 z-20 w-80">
                <pluginRun.plugin.Panel
                  host={makeHost(pluginRun.plugin)!}
                  block={pluginRun.block}
                  action={pluginRun.action}
                  onClose={closePlugin}
                />
              </div>
            )}
            {!schematic && (
              <Welcome loading={loading} onOpen={() => setOpenDialog(true)} onExample={() => void openUrl(EXAMPLE)} />
            )}
            {dragging && (
              <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center border-2 border-dashed border-primary bg-primary/10 text-lg font-medium text-primary">
                Отпустите файл .schematic
              </div>
            )}
            {loading && schematic && (
              <div className="absolute top-3 left-1/2 z-30 -translate-x-1/2 bg-card px-3 py-1 text-sm shadow">
                Загрузка…
              </div>
            )}
          </main>
        </div>
        <HotkeysDialog open={help} onOpenChange={setHelp} />
        <OpenDialog
          open={openDialog}
          onOpenChange={setOpenDialog}
          onUrl={(u) => void openUrl(u)}
          onFile={(f) => void openFile(f)}
          onExample={() => void openUrl(EXAMPLE)}
          loading={loading}
        />
      </div>
    </TooltipProvider>
  );
}

function Welcome({ loading, onOpen, onExample }: { loading: boolean; onOpen: () => void; onExample: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background p-4">
      <div
        className={cn(
          'flex max-w-md flex-col items-center gap-4 border bg-card p-8 text-center shadow-sm',
          loading && 'opacity-70',
        )}
      >
        <FolderOpen className="size-10 text-muted-foreground" />
        <div>
          <p className="text-lg font-semibold">{loading ? 'Загрузка…' : 'Откройте схематику'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Вставьте ссылку на файл <code>.schematic</code>, выберите его с диска или просто перетащите сюда.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onOpen} disabled={loading}>
            Открыть схематику
          </Button>
          <Button variant="outline" onClick={onExample} disabled={loading}>
            Пример: все блоки
          </Button>
        </div>
      </div>
    </div>
  );
}
