import type { Axis, NavMode, SliceState } from '../render/viewer';

export interface UrlState {
  url?: string;
  view?: NavMode;
  /** Slice from the link: `slice=y:5` (or the short form `y=5`), 1-based layer; `iso=1` to isolate. */
  slice?: Pick<SliceState, 'axis' | 'value' | 'isolate'>;
}

export function readUrlState(search = window.location.search): UrlState {
  const p = new URLSearchParams(search);
  const out: UrlState = {};
  const url = p.get('url');
  if (url) out.url = url;
  const view = p.get('view');
  if (view === 'plan' || view === 'top') out.view = 'plan';
  else if (view === 'orbit' || view === '3d') out.view = 'orbit';
  const iso = p.get('iso') === '1';
  const slice = p.get('slice');
  const m = slice?.match(/^([xyz]):(\d+)$/);
  if (m) out.slice = { axis: m[1] as Axis, value: Math.max(0, Number(m[2]) - 1), isolate: iso };
  else {
    const y = p.get('y');
    if (y !== null && /^\d+$/.test(y)) out.slice = { axis: 'y', value: Math.max(0, Number(y) - 1), isolate: iso };
  }
  return out;
}

/** Link to the current view; null when the schematic did not come from a URL. */
export function shareLink(url: string | undefined, view: NavMode, slice: SliceState): string | null {
  if (!url) return null;
  const p = new URLSearchParams();
  p.set('url', url);
  if (view === 'plan') p.set('view', 'plan');
  if (slice.enabled) {
    p.set('slice', `${slice.axis}:${slice.value + 1}`);
    if (slice.isolate) p.set('iso', '1');
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}
