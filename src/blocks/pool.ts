// Block pool: id/meta → name, render kind and textures. The single source of truth for blocks.
// Names shown to the user come from the game's item info (iteminfo.ts) when it has them.
// Texture numbers are slots of public/assets/terrain.png (see src/render/atlas.ts), taken from the game client.

import { hasOwnItem, itemInfo } from './iteminfo';

/** Sides as in the game: 0 bottom (−Y), 1 top (+Y), 2 −Z, 3 +Z, 4 −X, 5 +X. */
export type Side = 0 | 1 | 2 | 3 | 4 | 5;

export type RenderKind =
  | 'cube' // full block, textures per side/meta
  | 'fluid'
  | 'redstoneWire' // 55
  | 'electricWire' // 170
  | 'torch' // 75/76
  | 'lever' // 69
  | 'repeater' // 93/94
  | 'piston' // 29/33
  | 'superconductor' // 158: core + connectors to neighbours
  | 'lamp' // 138: light strip on the face given by meta
  | 'tube' // 172
  | 'fieldCube' // 229: translucent cube, no faces between neighbours
  | 'model' // XML model from public/assets/models
  | 'cauldron' // 211: vanilla cauldron
  | 'transport' // 212 pipe, 209 node: frame + glass by connections (src/render/transport.ts)
  | 'barrier' // 135: portal-like plate, 4 px thick, along the row of barriers
  | 'none'; // drawn by another block (piston head 34 is drawn by the piston base)

export type Pass = 'solid' | 'cutout' | 'translucent';

export type Group = 'base' | 'bak' | 'producer' | 'machines' | 'factory' | 'fluids';

export interface BlockDef {
  id: number;
  key: string; // name in the server code
  name: string; // Russian name
  group: Group;
  render: RenderKind;
  /** Texture slot for a side and metadata. */
  tex: (side: Side, meta: number) => number;
  /** Fully opaque full cube: hides neighbour faces (isOpaqueCube in the game). */
  opaque: boolean;
  pass: Pass;
  /** Fluid family for fluids. */
  fluid?: FluidKind;
  /** Meta-specific name override. */
  metaName?: (meta: number) => string | undefined;
  /** Model name per meta (render === 'model'); undefined → draw as cube. */
  model?: (meta: number) => string | undefined;
  /** Rotate the model by metadata like the client (2 → 180°, 4 → −90°, 5 → 90°). */
  rotateModel?: boolean;
  /** Colour for the legend / unknown fallback. */
  color: string;
}

export type FluidKind = 'water' | 'lava' | 'plasma' | 'oil';

const all = (t: number) => () => t;
const topBottom = (top: number, bottom: number, side: number) => (s: Side) =>
  s === 1 ? top : s === 0 ? bottom : side;

const defs: BlockDef[] = [];
function def(d: Omit<BlockDef, 'opaque' | 'pass'> & Partial<Pick<BlockDef, 'opaque' | 'pass'>>): void {
  defs.push({ opaque: d.render === 'cube', pass: 'solid', ...d });
}

// ── 4.1 Base and light ────────────────────────────────────────────────────────
def({ id: 4, key: 'cobblestone', name: 'Булыжник', group: 'base', render: 'cube', tex: all(16), color: '#7a7a7a' });
def({
  id: 138, key: 'lamp', name: 'Лампочка', group: 'base',
  render: 'lamp', tex: all(264), pass: 'cutout', color: '#f4e9a8',
});
def({ id: 89, key: 'glowStone', name: 'Светокамень', group: 'base', render: 'cube', tex: all(105), color: '#d9b25c' });
def({
  id: 20, key: 'glass', name: 'Стекло', group: 'base', render: 'cube',
  tex: (_s, m) => (m > 0 ? 912 + m : 912), opaque: false, pass: 'cutout', color: '#cfe8ef',
});

// ── 4.2 BAK ───────────────────────────────────────────────────────────────────
def({ id: 42, key: 'blockSteel', name: 'Железный блок (ЖБ)', group: 'bak', render: 'cube', tex: (_s, m) => 832 + m, color: '#d8d8d8' });
def({
  id: 158, key: 'superconductor', name: 'Сверхпроводник', group: 'bak',
  render: 'superconductor', tex: (_s, m) => (m >= 1 && m <= 3 ? 768 + m - 1 : 144), opaque: false, color: '#5b8bd6',
});
def({ id: 79, key: 'ice', name: 'Лёд', group: 'bak', render: 'cube', tex: all(67), opaque: false, pass: 'translucent', color: '#9cc3f5' });
def({ id: 160, key: 'terminal', name: 'Терминал', group: 'bak', render: 'cube', tex: topBottom(313, 314, 314), color: '#4a6a7a' });
def({
  id: 159, key: 'particlespray', name: 'Источник частиц', group: 'bak',
  render: 'model', tex: (s, m) => (m === 0 && (s === 0 || s === 1) ? 310 : 311), opaque: false,
  // Model by meta, as the client picks it (the tile entity type follows the meta). The meta is the type,
  // not a direction, so these models are not rotated.
  model: (m) => PARTICLESPRAY_MODELS[m],
  color: '#7c5fb0',
});
def({ id: 132, key: 'nuclearStone', name: 'Уран', group: 'bak', render: 'cube', tex: all(282), color: '#53c043' });
def({ id: 161, key: 'plutoniy', name: 'Плутоний', group: 'bak', render: 'cube', tex: all(500), color: '#3a3a3a' });
def({ id: 226, key: 'generator', name: 'Генератор', group: 'bak', render: 'cube', tex: topBottom(299, 300, 300), color: '#8a6d3b' });
def({
  id: 55, key: 'redstoneWire', name: 'Провод (редстоун)', group: 'bak',
  render: 'redstoneWire', tex: all(164), opaque: false, pass: 'cutout', color: '#b01010',
});
def({ id: 137, key: 'gate', name: 'Шлюз', group: 'bak', render: 'cube', tex: (s, m) => (s === 0 || s === 1 ? 283 : m > 0 ? 263 : 262), color: '#6b8f4e' });
def({
  id: 230, key: 'detector', name: 'Детектор', group: 'bak',
  render: 'cube', tex: (s, m) => (s === (m & 7) ? 316 : 315), color: '#59606b',
});
def({
  id: 33, key: 'pistonBase', name: 'Поршень', group: 'bak', render: 'piston',
  tex: pistonTex(107), opaque: false, color: '#a08455',
});
def({
  id: 29, key: 'pistonStickyBase', name: 'Липкий поршень', group: 'bak', render: 'piston',
  tex: pistonTex(106), opaque: false, color: '#8aa055',
});
def({
  id: 34, key: 'pistonExtension', name: 'Голова поршня', group: 'bak', render: 'none',
  tex: all(107), opaque: false, color: '#a08455',
});
def({ id: 69, key: 'lever', name: 'Рычаг', group: 'bak', render: 'lever', tex: all(96), opaque: false, pass: 'cutout', color: '#6b5a3a' });
def({
  id: 93, key: 'redstoneRepeater', name: 'Повторитель', group: 'bak',
  render: 'repeater', tex: repeaterTex(false), opaque: false, pass: 'cutout', color: '#9c9c9c',
});
def({
  id: 94, key: 'redstoneRepeater', name: 'Повторитель (включён)', group: 'bak',
  render: 'repeater', tex: repeaterTex(true), opaque: false, pass: 'cutout', color: '#c9a0a0',
});
def({ id: 75, key: 'torchRedstone', name: 'Красный факел (выкл.)', group: 'bak', render: 'torch', tex: all(115), opaque: false, pass: 'cutout', color: '#6e2a2a' });
def({ id: 76, key: 'torchRedstone', name: 'Красный факел', group: 'bak', render: 'torch', tex: all(99), opaque: false, pass: 'cutout', color: '#e03030' });

// ── 4.3 Uranium synthesizer and its structures ───────────────────────────────
def({ id: 131, key: 'nuclearProducer', name: 'Синтезатор', group: 'producer', render: 'cube', tex: all(281), color: '#3f7f4f' });
def({ id: 49, key: 'obsidian', name: 'Обсидиан', group: 'producer', render: 'cube', tex: all(37), color: '#1d1530' });
def({ id: 177, key: 'redBlock', name: 'Блок редстоуна', group: 'producer', render: 'cube', tex: all(464), opaque: false, color: '#b31b1b' });
def({
  id: 100, key: 'number', name: 'Цифра', group: 'producer', render: 'cube',
  tex: (_s, m) => (m === 15 ? 368 : 368 + (m < 10 ? m : m + 6)), color: '#e8e8e8',
});
def({ id: 178, key: 'stealBlock', name: 'Стальной блок', group: 'producer', render: 'cube', tex: (_s, m) => (m === 1 ? 498 : m === 2 ? 58 : 497), color: '#8d99a6' });
def({
  id: 179, key: 'nickelBlock', name: 'Никелевый блок', group: 'producer', render: 'cube',
  tex: (s, m) => (m === 1 ? 467 - 16 : m > 1 ? 928 + m : s === 0 ? 467 - 15 : s === 1 ? 468 : 467), color: '#b7b48f',
});
def({ id: 129, key: 'counter', name: 'Счётчик', group: 'producer', render: 'cube', tex: (_s, m) => (m === 0 ? 368 : 368 + (m < 10 ? m : 0)), opaque: false, color: '#dcdcdc' });
def({ id: 231, key: 'efGenerator', name: 'Генератор энергополя', group: 'producer', render: 'cube', tex: topBottom(309, 310, 310), color: '#4d6fa8' });
def({ id: 135, key: 'barrier', name: 'Барьер', group: 'producer', render: 'barrier', tex: all(14), opaque: false, pass: 'translucent', color: '#7fb6ff' });
def({ id: 248, key: 'efBridge', name: 'Энергомост', group: 'producer', render: 'cube', tex: all(501), opaque: false, pass: 'translucent', color: '#86e0ff' });
def({ id: 229, key: 'energyField', name: 'Энергополе', group: 'producer', render: 'fieldCube', tex: all(496), opaque: false, pass: 'translucent', color: '#6ad1ff' });

// ── 4.4 Machines ──────────────────────────────────────────────────────────────
def({
  id: 170, key: 'electricWire', name: 'Электропровод', group: 'machines',
  render: 'electricWire', tex: all(164), opaque: false, pass: 'cutout', color: '#2a5bd7',
});
def({ id: 171, key: 'pump', name: 'Насос', group: 'machines', render: 'model', tex: (s) => (s === 0 || s === 1 ? 433 : 449), opaque: false, model: () => 'pump', color: '#5a6d7a' });
def({ id: 172, key: 'tubeWire', name: 'Труба', group: 'machines', render: 'tube', tex: all(448), opaque: false, color: '#7d8c99' });
def({ id: 173, key: 'tank', name: 'Бак', group: 'machines', render: 'model', tex: (s) => (s === 0 || s === 1 ? 438 : 454), opaque: false, model: () => 'tank', color: '#6f8796' });
def({ id: 243, key: 'compressor', name: 'Компрессор', group: 'machines', render: 'cube', tex: topBottom(322, 321, 321), color: '#7a7f86' });
def({ id: 154, key: 'tonedGlass', name: 'Тонированное стекло', group: 'machines', render: 'cube', tex: all(276), opaque: false, pass: 'translucent', color: '#4c5a66' });

// ── Factory ───────────────────────────────────────────────────────────────────
def({ id: 61, key: 'stoneOvenIdle', name: 'Печь', group: 'factory', render: 'cube', tex: furnaceTex(false), color: '#6b6b6b' });
def({ id: 62, key: 'stoneOvenActive', name: 'Работающая печь', group: 'factory', render: 'cube', tex: furnaceTex(true), color: '#8a6b4b' });
// Cauldron (item 380 places block 211): the vanilla cauldron shape — outer cube, inner walls and a floor.
def({ id: 211, key: 'cauldron', name: 'Котёл', group: 'factory', render: 'cauldron', tex: (s) => (s === 1 ? 138 : s === 0 ? 155 : 154), opaque: false, pass: 'cutout', color: '#3a3a3a' });

// Transport system: pipes 212 (meta = colour: 0 black, 1 red, 4 green, 2 closed, 3 coupling) and nodes 209.
const PIPE_TEX: Record<number, number> = { 0: 872, 1: 874, 2: 727, 3: 875, 4: 878 };
def({ id: 212, key: 'transportTube', name: 'Транспортная труба', group: 'factory', render: 'transport', tex: (_s, m) => PIPE_TEX[m] ?? 872, opaque: false, pass: 'cutout', color: '#4a4f57' });
def({ id: 209, key: 'transportNode', name: 'Транспортный узел', group: 'factory', render: 'transport', tex: () => 870, opaque: false, pass: 'cutout', color: '#5d6570' });

// ── 4.5 Fluids (flowing / still) and interaction products ────────────────────
const fluidTex = (base: number) => (s: Side) => (s === 0 || s === 1 ? base : base + 1);
for (const [flowing, still, kind, name, base, color] of [
  [8, 9, 'water', 'Вода', 12 * 16 + 13, '#3b62d6'],
  [10, 11, 'lava', 'Лава', 14 * 16 + 13, '#e35d12'],
  [97, 98, 'plasma', 'Плазма', 16 * 16 + 13, '#9a5cf0'],
  [143, 144, 'oil', 'Нефть', 18 * 16 + 13, '#2b2420'],
] as const) {
  // Plasma and oil have the names swapped in the server code (*Still = flowing); ids decide.
  for (const [id, state] of [[flowing, 'текущая'], [still, 'стоячая']] as const) {
    def({
      id, key: kind, name: `${name} (${state})`, group: 'fluids',
      render: 'fluid', fluid: kind, tex: fluidTex(base), opaque: false, pass: kind === 'lava' ? 'solid' : 'translucent', color,
    });
  }
}
def({ id: 157, key: 'magma', name: 'Магма', group: 'fluids', render: 'cube', tex: all(298), color: '#7a2a10' });

const PARTICLESPRAY_MODELS: Record<number, string> = {
  1: 'nuclearcontainer',
  2: 'crusher',
  3: 'powertransmitter',
  4: 'factory/node-1', // контейнер для сырья ур.1
  5: 'factory/factory-1', // фабрика ур.1
  6: 'factory/node-2',
  7: 'factory/factory-2',
  8: 'factory/node-3',
  9: 'factory/factory-3',
  10: 'drawtable', // проектировочный стол
  11: 'drawtable',
  12: 'concrete_mixer/v2', // бетономешалка
};

/**
 * Furnace 61 (62 — burning). Meta 0..7: ordinary furnace, front = meta (0 → +Z); meta ≥ 8: electric furnace,
 * front = meta & 7. Without the tile entity the furnace is drawn idle (62 — lit).
 */
function furnaceTex(lit: boolean) {
  return (s: Side, m: number) => {
    if (m >> 3 > 0) {
      if (s === 0 || s === 1) return 98;
      const f = m & 7;
      if (f > 0) return s === f ? (lit ? 97 : 81) : 82;
      return s === 3 ? (lit ? 97 : 81) : 82;
    }
    if (s === 0 || s === 1) return 62;
    if (m > 0) return s === m ? (lit ? 61 : 44) : 45;
    return s === 3 ? (lit ? 61 : 44) : 45;
  };
}

function pistonTex(front: number) {
  // side == facing → front, opposite → back (109), other → side (108). Facing = meta & 7.
  return (s: Side, m: number) => {
    const facing = m & 7;
    if (facing > 5) return front;
    if (s === facing) return (m & 8) !== 0 ? 110 : front;
    return s === [1, 0, 3, 2, 5, 4][facing] ? 109 : 108;
  };
}

function repeaterTex(on: boolean) {
  return (s: Side) => (s === 0 ? (on ? 99 : 115) : s === 1 ? (on ? 147 : 131) : 5);
}

export const BLOCKS: ReadonlyMap<number, BlockDef> = new Map(defs.map((d) => [d.id, d]));

export const GROUP_NAMES: Record<Group, string> = {
  base: 'Основа и свет',
  bak: 'БАК',
  producer: 'Синтезатор и структуры',
  machines: 'Машины',
  factory: 'Завод',
  fluids: 'Жидкости',
};

export function blockDef(id: number): BlockDef | undefined {
  return BLOCKS.get(id);
}

/** Name as in the game (item info), or the pool name. */
export function blockName(id: number, meta: number): string {
  const d = BLOCKS.get(id);
  const own = d?.metaName?.(meta);
  if (own) return own;
  const info = itemInfo(id, meta);
  if (info) return info[0];
  return d ? d.name : `Блок ${id}`;
}

/** Game description from item info. */
export function blockDescription(id: number, meta: number): string | undefined {
  return itemInfo(id, meta)?.[1] || undefined;
}

/** Torch-like blocks that a redstone wire connects to (in addition to wires and repeaters). */
export const REDSTONE_PROVIDERS = new Set([55, 69, 75, 76, 129, 177, 230]);
/** Blocks that an electric wire connects to. */
export const ELECTRIC_CONNECT = new Set([170, 171]);
/** Blocks a tube connects to. */
export const TUBE_CONNECT = new Set([172, 171, 173]);

/**
 * Block variant as the game lists items: "id:meta" when that meta is an item of its own (42:6 titanium,
 * 159:2 crusher), otherwise "id:0" (fluid levels, rotations, signal strength stay one entry).
 */
export function variantMeta(id: number, meta: number): number {
  return hasOwnItem(id, meta) ? meta : 0;
}

export function variantKey(id: number, meta: number): string {
  return `${id}:${variantMeta(id, meta)}`;
}

/** Game name of a variant for lists (item name; for unknown items — the pool name). */
export function variantName(id: number, meta: number): string {
  const vm = variantMeta(id, meta);
  return itemInfo(id, vm)?.[0] ?? blockName(id, vm);
}

/** All model names used by the pool (loaded by the viewer). */
export const MODEL_NAMES: readonly string[] = [
  ...new Set(
    [...BLOCKS.values()].flatMap((d) => (d.model ? Array.from({ length: 16 }, (_, m) => d.model!(m)).filter((x): x is string => !!x) : [])),
  ),
];
