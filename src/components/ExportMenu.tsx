import { Check, Copy, Download, Share } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { materialsBbcode, materialsMarkdown, type MaterialList } from '../app/export';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from './Tip';

type Format = 'md' | 'bbcode';

/** Labels: exportMenu.formats.<id> in the messages. */
const FORMATS: { id: Format; ext: string; make: (l: MaterialList) => string }[] = [
  { id: 'md', ext: 'md', make: materialsMarkdown },
  { id: 'bbcode', ext: 'txt', make: materialsBbcode },
];

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Export" menu of the block list: the material list as Markdown or forum BBCode. */
export function ExportMenu({ list }: { list: MaterialList }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<Format | null>(null);
  const base = list.fileName.replace(/\.[^.]+$/, '') || 'schematic';
  const fileName = (f: (typeof FORMATS)[number]) => `${base}-${t('exportMenu.fileSuffix')}.${f.ext}`;

  const copy = async (f: (typeof FORMATS)[number]) => {
    const text = f.make(list);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(f.id);
      setTimeout(() => setCopied((c) => (c === f.id ? null : c)), 1500);
    } catch {
      download(fileName(f), text);
    }
  };

  return (
    <Popover>
      <Tip content={t('exportMenu.tip')}>
        <PopoverTrigger render={<Button variant="ghost" size="xs" className="-my-1 text-muted-foreground" />}>
          <Share /> {t('exportMenu.button')}
        </PopoverTrigger>
      </Tip>
      <PopoverContent side="bottom" align="start" className="w-64 gap-0 p-2">
        <div className="px-2 pt-1.5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {t('exportMenu.title')}
        </div>
        {FORMATS.map((f) => (
          <div key={f.id} className="flex items-center gap-1 p-1">
            <span className="flex-1 pl-1 text-[12.5px]">{t(`exportMenu.formats.${f.id}`)}</span>
            <Tip content={t('exportMenu.copy')}>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`${t('exportMenu.copy')}: ${t(`exportMenu.formats.${f.id}`)}`}
                className="text-muted-foreground"
                onClick={() => void copy(f)}
              >
                {copied === f.id ? <Check /> : <Copy />}
              </Button>
            </Tip>
            <Tip content={t('exportMenu.download')}>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`${t('exportMenu.download')}: ${t(`exportMenu.formats.${f.id}`)}`}
                className="text-muted-foreground"
                onClick={() => download(fileName(f), f.make(list))}
              >
                <Download />
              </Button>
            </Tip>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
