import { FileUp, Link2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, cn, Dialog } from './kit';

/** One dialog to open a schematic: paste a link or pick / drop a file. */
export function OpenDialog({
  open,
  onOpenChange,
  onUrl,
  onFile,
  onExample,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUrl: (url: string) => void;
  onFile: (f: File) => void;
  onExample: () => void;
  loading: boolean;
}) {
  const [url, setUrl] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setOver(false);
  }, [open]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    onFile(f);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Открыть схематику"
      description="Ссылка на файл .schematic или файл с диска."
      className="w-[min(520px,calc(100vw-32px))]"
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = url.trim();
          if (!v) return;
          onUrl(v);
          onOpenChange(false);
        }}
      >
        <label
          htmlFor="open-url"
          className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
        >
          Ссылка
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="open-url"
              type="url"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/build.schematic"
              className="h-9 w-full border bg-background pr-2 pl-8 text-sm"
            />
          </div>
          <Button type="submit" disabled={loading || !url.trim()}>
            Открыть
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Сервер должен разрешать чтение с других сайтов (CORS): подойдут raw.githubusercontent.com, gist, Discord CDN.
        </p>
      </form>

      <div className="my-5 flex items-center gap-3 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        или
        <span className="h-px flex-1 bg-border" />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".schematic,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-2 border-2 border-dashed px-4 py-8 text-center transition-colors',
          over ? 'border-primary bg-primary/10' : 'hover:border-foreground/30 hover:bg-muted/50',
        )}
      >
        <FileUp className="size-7 text-muted-foreground" />
        <span className="text-sm font-medium">Выберите файл или перетащите его сюда</span>
        <span className="text-xs text-muted-foreground">.schematic (MCEdit)</span>
      </button>

      <div className="mt-4 text-center">
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => {
            onExample();
            onOpenChange(false);
          }}
        >
          Открыть пример со всеми блоками
        </button>
      </div>
    </Dialog>
  );
}
