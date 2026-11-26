// What the address bar holds: the schematic (a link or a bundled example), the view and the page layout.
//
//   ?url=<link>            schematic by link (bundled examples too: ./examples/<name>.schematic)
//   view=orbit|plan|explore navigation mode (old names: 3d, top; walk for explore)
//   slice=y:5 (or y=5), iso=1  slice, 1-based layer; iso — only that layer
//   cam=x,y,z & at=x,y,z   camera position and the point it looks at; rot=1..3 — plan turned by quarter turns
//   embed=1                only the 3D view: no header (for embedding)
//   list=0|1               block list collapsed / shown
//   theme=dark|light       colour theme
// list and theme only override the user's saved settings for this page; they are never saved.

import type { Axis, CameraPose, NavMode, SliceState } from '../render/viewer';

export interface UrlState {
  url?: string;
  view?: NavMode;
  slice?: Pick<SliceState, 'axis' | 'value' | 'isolate'>;
  camera?: CameraPose;
  embed?: boolean;
  /** false — block list collapsed. */
  list?: boolean;
  /** true — dark theme. */
  dark?: boolean;
}

function vec(s: string | null): [number, number, number] | undefined {
  const parts = s?.split(',').map(Number);
  return parts && parts.length === 3 && parts.every(Number.isFinite) ? (parts as [number, number, number]) : undefined;
}

export function readUrlState(search = window.location.search): UrlState {
  const p = new URLSearchParams(search);
  const out: UrlState = {};
  const url = p.get('url');
  if (url) out.url = url;
  const view = p.get('view');
  if (view === 'plan' || view === 'top') out.view = 'plan';
  else if (view === 'orbit' || view === '3d') out.view = 'orbit';
  else if (view === 'explore' || view === 'walk') out.view = 'explore';
  const iso = p.get('iso') === '1';
  const slice = p.get('slice');
  const m = slice?.match(/^([xyz]):(\d+)$/);
  if (m) out.slice = { axis: m[1] as Axis, value: Math.max(0, Number(m[2]) - 1), isolate: iso };
  else {
    const y = p.get('y');
    if (y !== null && /^\d+$/.test(y)) out.slice = { axis: 'y', value: Math.max(0, Number(y) - 1), isolate: iso };
  }
  const pos = vec(p.get('cam'));
  const at = vec(p.get('at'));
  if (pos && at) {
    const rot = Number(p.get('rot'));
    out.camera = { pos, at, rot: Number.isInteger(rot) ? ((rot % 4) + 4) % 4 : 0 };
  }
  if (p.get('embed') === '1') out.embed = true;
  const list = p.get('list');
  if (list === '0') out.list = false;
  else if (list === '1') out.list = true;
  const theme = p.get('theme');
  if (theme === 'dark') out.dark = true;
  else if (theme === 'light') out.dark = false;
  return out;
}

export interface LinkState {
  /** Schematic link (?url=). */
  url?: string;
  view: NavMode;
  slice: SliceState;
  /** null — the default framing (not written). */
  camera: CameraPose | null;
  embed: boolean;
  /** Overrides from the link still in force (undefined — none). */
  list?: boolean;
  dark?: boolean;
}

const num = (v: number) => String(Math.round(v * 100) / 100);
const vecStr = (v: readonly number[]) => v.map(num).join(',');

/**
 * Address of the current view. `root` is the app's address (…/mcgl-schematic/). A schematic opened from disk has no
 * address: only the layout parameters are kept.
 */
export function viewLink(s: LinkState, root: string): string {
  const q: string[] = [];
  if (s.url !== undefined) {
    q.push(`url=${encodeURIComponent(s.url)}`);
    if (s.view !== 'orbit') q.push(`view=${s.view}`);
    if (s.slice.enabled) {
      q.push(`slice=${s.slice.axis}:${s.slice.value + 1}`);
      if (s.slice.isolate) q.push('iso=1');
    }
    if (s.camera) {
      q.push(`cam=${vecStr(s.camera.pos)}`, `at=${vecStr(s.camera.at)}`);
      if (s.camera.rot) q.push(`rot=${s.camera.rot}`);
    }
  }
  if (s.embed) q.push('embed=1');
  if (s.list !== undefined) q.push(`list=${s.list ? 1 : 0}`);
  if (s.dark !== undefined) q.push(`theme=${s.dark ? 'dark' : 'light'}`);
  return q.length ? `${root}?${q.join('&')}` : root;
}

/** The app's address (the page without query and hash). */
export function appRoot(): string {
  return window.location.origin + window.location.pathname;
}
