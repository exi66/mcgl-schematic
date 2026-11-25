import { parseSchematic, SchematicError, type Schematic } from '../schematic/schematic';

export class LoadError extends Error {}

export async function loadFromUrl(url: string, signal?: AbortSignal): Promise<Schematic> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new LoadError(
      'Не удалось скачать файл: сервер недоступен или не разрешает чтение с других сайтов (CORS). ' +
        'Подойдут raw.githubusercontent.com, gist, Discord CDN — или откройте файл с диска.',
    );
  }
  if (res.status === 404) throw new LoadError('Файл не найден (404).');
  if (!res.ok) throw new LoadError(`Сервер ответил ${res.status} ${res.statusText}.`);
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
    throw new LoadError(`Не схематика: ${(e as Error).message}`);
  }
}
