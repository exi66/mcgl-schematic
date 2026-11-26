import { createContext, useContext, useEffect, useState } from 'react';
import { blockDef, type RenderKind, type Side } from '../blocks/pool';
import { tileX, tileY } from '../render/atlas';
import { getModelIcon, peekModelIcon } from '../render/model-icons';
import { FX_SLOTS } from '../render/texfx';
import { cn } from '@/lib/utils';

const BASE = import.meta.env.BASE_URL;
export const TerrainUrlContext = createContext<string | null>(null);
const FX_INDEX = new Map<number, number>(FX_SLOTS.map((s, i) => [s, i]));

/** Face shown as the icon: the front, like an item in the game; the top only where the top is the face. */
function iconSide(id: number, render: RenderKind, meta: number): Side {
  if (render === 'fluid' || render === 'redstoneWire' || render === 'electricWire' || render === 'repeater') return 1;
  if (render === 'torch' || render === 'lever') return 2;
  // Directional blocks: the side they face.
  if (render === 'piston' || id === 230) {
    const f = meta & 7;
    if (f <= 5) return f as Side;
  }
  return 3;
}

/**
 * A block's texture as an icon. Tiles the game animates (fluids, plutonium, titanium, energy field, bridge,
 * barrier) come from fx-icons.png, generated at build time from the same effects (last frame).
 * Models get a colour swatch, blocks outside the pool — an id badge.
 */
export function BlockIcon({
  id,
  meta,
  size = 20,
  className,
}: {
  id: number;
  meta: number;
  size?: number;
  className?: string;
}) {
  const terrainUrl = useContext(TerrainUrlContext);
  const d = blockDef(id);
  const modelName = d?.model?.(meta);
  const [loaded, setLoaded] = useState<{ name: string; src: string | null } | null>(null);

  useEffect(() => {
    if (!modelName || peekModelIcon(modelName) !== undefined) return;
    let cancelled = false;
    void getModelIcon(modelName).then((src) => {
      if (!cancelled) setLoaded({ name: modelName, src });
    });
    return () => {
      cancelled = true;
    };
  }, [modelName]);

  if (!d) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center bg-neutral-500 text-[9px] font-bold text-white',
          className,
        )}
        style={{ width: size, height: size }}
      >
        {id}
      </span>
    );
  }
  if (modelName) {
    const cached = peekModelIcon(modelName);
    const src = cached !== undefined ? cached : loaded?.name === modelName ? loaded.src : null;
    if (src) {
      return (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className={cn('pixelated inline-block shrink-0', className)}
          style={{ width: size, height: size }}
        />
      );
    }
    return (
      <span
        className={cn('inline-block shrink-0', className)}
        style={{ width: size, height: size, backgroundColor: d.color }}
      />
    );
  }
  const tex = d.tex(iconSide(d.id, d.render, meta), meta);
  const k = size / 16;
  const fx = FX_INDEX.get(tex);
  const wire = d.render === 'redstoneWire' || d.render === 'electricWire';
  const style: React.CSSProperties =
    fx !== undefined
      ? {
          // Translucent frames (energy field, bridge, water) sit on the muted background.
          backgroundImage: `url(${BASE}assets/fx-icons.png)`,
          backgroundSize: `${16 * FX_SLOTS.length * k}px ${size}px`,
          backgroundPosition: `${-fx * 16 * k}px 0px`,
          backgroundColor: 'var(--muted)',
        }
      : {
          backgroundImage: `url(${terrainUrl ?? `${BASE}assets/terrain.png`})`,
          backgroundSize: `${512 * k}px ${512 * k}px`,
          backgroundPosition: `${-tileX(tex) * k}px ${-tileY(tex) * k}px`,
          backgroundColor: wire ? d.color : undefined,
          backgroundBlendMode: wire ? 'multiply' : undefined,
        };
  return (
    <span
      className={cn('pixelated inline-block shrink-0', className)}
      style={{ width: size, height: size, ...style }}
    />
  );
}
