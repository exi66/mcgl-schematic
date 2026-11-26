import i18next from 'i18next';
import { parseSchematic, SchematicError, type Schematic } from '../schematic/schematic';

export class LoadError extends Error {}

export async function loadFromUrl(url: string, signal?: AbortSignal): Promise<Schematic> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new LoadError(i18next.t('errors.download'));
  }
  if (res.status === 404) throw new LoadError(i18next.t('errors.notFound'));
  if (!res.ok) throw new LoadError(i18next.t('errors.http', { status: `${res.status} ${res.statusText}`.trim() }));
  return parseBytes(new Uint8Array(await res.arrayBuffer()));
}

export async function loadFromFile(file: File): Promise<Schematic> {
  return parseBytes(new Uint8Array(await file.arrayBuffer()));
}

async function parseBytes(bytes: Uint8Array): Promise<Schematic> {
  try {
    return await parseSchematic(bytes);
  } catch (e) {
    if (e instanceof SchematicError) throw new LoadError(e.message);
    throw new LoadError(i18next.t('errors.notSchematic', { reason: (e as Error).message }));
  }
}
