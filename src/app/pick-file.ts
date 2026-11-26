// Picking a schematic from disk. A web page cannot see file paths; where the File System Access API exists
// (Chrome, Edge, Opera) the picker gets an id, and the browser reopens it in the folder of the last file picked
// with that id, also after a restart. Elsewhere (Firefox, Safari) the dialog falls back to <input type="file">,
// and those browsers remember the last folder themselves.

interface OpenFilePickerOptions {
  id?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}
type ShowOpenFilePicker = (o: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;

const picker = (): ShowOpenFilePicker | undefined =>
  (window as unknown as { showOpenFilePicker?: ShowOpenFilePicker }).showOpenFilePicker;

/** The browser can open its own picker that remembers the folder. */
export const canPickFile = (): boolean => picker() !== undefined;

/** Opens the picker (call from a click); null if the user cancelled. */
export async function pickSchematicFile(): Promise<File | null> {
  const show = picker();
  if (!show) return null;
  try {
    const [handle] = await show.call(window, {
      id: 'schematic',
      types: [{ description: 'MCEdit .schematic', accept: { 'application/octet-stream': ['.schematic'] } }],
    });
    return handle ? await handle.getFile() : null;
  } catch (e) {
    if ((e as Error).name === 'AbortError') return null;
    throw e;
  }
}
