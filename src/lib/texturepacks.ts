import i18next from 'i18next';
import { ATLAS_SIZE } from '@/render/atlas';

export interface TexturePackMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  sizeBytes: number;
  addedAt: number;
}

interface StoredPack extends TexturePackMeta {
  blob: Blob;
}

const DB_NAME = 'mcgl-schematic-texturepacks';
const STORE_NAME = 'packs';
const DB_VERSION = 1;

const urlCache = new Map<string, string>();
const memoryStore = new Map<string, StoredPack>();

/** The built-in HD atlas, selectable like a saved pack (its id is stored as the active pack). */
export const BUILTIN_HD_PACK = {
  id: 'builtin:hd',
  url: `${import.meta.env.BASE_URL}assets/terrain-hd.png`,
  size: 2048,
} as const;

/** Largest accepted terrain.png side: 2048 is 64-px tiles; larger atlases risk the GPU texture limit and a huge getImageData. */
export const MAX_TERRAIN_SIZE = 2048;

export function isValidTerrainSize(width: number, height: number): boolean {
  return width === height && width >= ATLAS_SIZE && width <= MAX_TERRAIN_SIZE && width % 32 === 0;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function measureImage(file: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    const res = { width: bmp.width, height: bmp.height };
    bmp.close();
    return res;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Pack name shown in the list: the file name without .png. */
export function packName(file: File): string {
  return file.name.replace(/\.png$/i, '') || 'terrain';
}

function toMeta(p: StoredPack): TexturePackMeta {
  return {
    id: p.id,
    name: p.name,
    width: p.width,
    height: p.height,
    sizeBytes: p.sizeBytes,
    addedAt: p.addedAt,
  };
}

export async function listTexturePacks(): Promise<TexturePackMeta[]> {
  const db = await openDb();
  if (!db) {
    return [...memoryStore.values()].map(toMeta).sort((a, b) => a.addedAt - b.addedAt);
  }
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const rows = (req.result as StoredPack[]) ?? [];
        resolve(rows.map(toMeta).sort((a, b) => a.addedAt - b.addedAt));
      };
      req.onerror = () => resolve([]);
    });
  } finally {
    db.close();
  }
}

export async function saveTexturePack(file: File): Promise<TexturePackMeta> {
  let width = 0;
  let height = 0;
  try {
    const dims = await measureImage(file);
    width = dims.width;
    height = dims.height;
  } catch {
    throw new Error(i18next.t('texturepack.invalidImage'));
  }
  if (!isValidTerrainSize(width, height)) {
    throw new Error(i18next.t('texturepack.invalidSize', { width, height }));
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pack: StoredPack = {
    id,
    name: packName(file),
    width,
    height,
    sizeBytes: file.size,
    addedAt: Date.now(),
    blob: file,
  };

  const db = await openDb();
  if (!db) {
    memoryStore.set(id, pack);
    return toMeta(pack);
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(pack);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    });
    return toMeta(pack);
  } finally {
    db.close();
  }
}

export async function getTexturePackUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;

  let pack: StoredPack | undefined;
  const db = await openDb();
  if (!db) {
    pack = memoryStore.get(id);
  } else {
    try {
      pack = await new Promise<StoredPack | undefined>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result as StoredPack | undefined);
        req.onerror = () => resolve(undefined);
      });
    } finally {
      db.close();
    }
  }
  if (!pack) return null;
  const url = URL.createObjectURL(pack.blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteTexturePack(id: string): Promise<void> {
  const cached = urlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlCache.delete(id);
  }
  memoryStore.delete(id);
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } finally {
    db.close();
  }
}
