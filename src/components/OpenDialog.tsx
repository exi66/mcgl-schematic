import { FileUp, Link2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canPickFile, pickSchematicFile } from '../app/pick-file';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

/** One dialog to open a schematic: paste a link or pick / drop a file. */
export function OpenDialog({
  open,
  onOpenChange,
  onUrl,
  onFile,
  onExample,
  onError,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUrl: (url: string) => void;
  onFile: (f: File) => void;
  onExample: () => void;
  onError: (message: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setOver(false);
  }, [open]);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    onFile(f);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 sm:max-w-[520px]">
        <DialogHeader className="mb-5">
          <DialogTitle>{t('open.title')}</DialogTitle>
          <DialogDescription>{t('open.description')}</DialogDescription>
        </DialogHeader>
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
          <Label htmlFor="open-url">{t('open.link')}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="open-url"
                type="url"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…/build.schematic"
                className="pl-8"
              />
            </div>
            <Button type="submit" disabled={loading || !url.trim()}>
              {t('open.submit')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('open.corsHint')}</p>
        </form>

        <div className="my-5 flex items-center gap-3 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          <Separator className="flex-1" />
          {t('open.or')}
          <Separator className="flex-1" />
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
          onClick={() => {
            if (!canPickFile()) fileRef.current?.click();
            else pickSchematicFile().then(pick, (e: Error) => onError(e.message));
          }}
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
          <span className="text-sm font-medium">{t('open.dropzone')}</span>
          <span className="text-xs text-muted-foreground">.schematic (MCEdit)</span>
        </button>

        <div className="mt-4 text-center">
          <Button
            variant="link"
            size="xs"
            className="text-muted-foreground"
            onClick={() => {
              onExample();
              onOpenChange(false);
            }}
          >
            {t('open.example')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
