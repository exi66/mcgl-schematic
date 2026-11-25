import { Check, Copy, Download, Share } from 'lucide-react';
import { useState } from 'react';
import { materialsBbcode, materialsMarkdown, type MaterialList } from '../app/export';
import { Popover, PopoverContent, PopoverTrigger, Tip } from './kit';

type Format = 'md' | 'bbcode';

const FORMATS: { id: Format; label: string; ext: string; make: (l: MaterialList) => string }[] = [
  { id: 'md', label: 'Markdown', ext: 'md', make: materialsMarkdown },
  { id: 'bbcode', label: 'BBCode (форум)', ext: 'txt', make: materialsBbcode },
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
  const [copied, setCopied] = useState<Format | null>(null);
  const base = list.fileName.replace(/\.[^.]+$/, '') || 'schematic';

  const copy = async (f: (typeof FORMATS)[number]) => {
    const text = f.make(list);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(f.id);
      setTimeout(() => setCopied((c) => (c === f.id ? null : c)), 1500);
    } catch {
      download(`${base}-материалы.${f.ext}`, text);
    }
  };

  return (
    <Popover>
      <Tip content="Экспорт списка материалов">
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground data-[state=open]:text-foreground [&_svg]:size-3.5">
            <Share /> Экспорт
          </button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent side="bottom" align="start" className="w-64 p-2">
        <div className="px-2 pt-1.5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Список материалов</div>
        {FORMATS.map((f) => (
          <div key={f.id} className="flex items-center gap-1 p-1">
            <span className="flex-1 pl-1 text-[12.5px]">{f.label}</span>
            <Tip content="Скопировать">
              <button type="button" aria-label={`Скопировать ${f.label}`} className="p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground [&_svg]:size-3.5" onClick={() => void copy(f)}>
                {copied === f.id ? <Check /> : <Copy />}
              </button>
            </Tip>
            <Tip content="Скачать файлом">
              <button
                type="button"
                aria-label={`Скачать ${f.label}`}
                className="p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground [&_svg]:size-3.5"
                onClick={() => download(`${base}-материалы.${f.ext}`, f.make(list))}
              >
                <Download />
              </button>
            </Tip>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
