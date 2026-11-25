// Game names and descriptions of blocks (id < 256) by "id:meta", taken from the game's item info file.
import data from './iteminfo.json';

const info = data as unknown as Record<string, [string, string]>;

/** [name, description] for id:meta, falling back to meta 0. */
export function itemInfo(id: number, meta: number): [string, string] | undefined {
  return info[`${id}:${meta}`] ?? info[`${id}:0`];
}

/** True if the game lists id:meta as an item of its own (e.g. 42:6 titanium), not just a state of the block. */
export function hasOwnItem(id: number, meta: number): boolean {
  return meta !== 0 && `${id}:${meta}` in info;
}
