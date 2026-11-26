import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

type Row = [label: string, keys: ReactNode[]];

const sections = (t: TFunction): [string, Row[]][] => [
  [
    t('hotkeys.sections.view'),
    [
      [t('hotkeys.orbit'), ['1']],
      [t('hotkeys.plan'), ['2']],
      [t('hotkeys.explore'), ['3']],
      [t('hotkeys.reset'), ['R']],
      [t('hotkeys.slice'), ['L']],
      [t('hotkeys.rotate'), ['Q', 'E']],
      [t('hotkeys.ortho'), ['O']],
      [t('hotkeys.grid'), ['G']],
    ],
  ],
  [
    t('hotkeys.sections.slice'),
    [
      [t('hotkeys.nextLayer'), [']']],
      [t('hotkeys.prevLayer'), ['[']],
      [t('hotkeys.tenLayers'), ['⇧', '[', ']']],
      [t('hotkeys.isolate'), ['I']],
    ],
  ],
  [
    t('hotkeys.sections.explore'),
    [
      [t('hotkeys.move'), ['W', 'A', 'S', 'D']],
      [t('hotkeys.jump'), ['Space']],
      [t('hotkeys.flyWalk'), ['Space', 'Space']],
      [t('hotkeys.sneak'), ['⇧']],
      [t('hotkeys.sprint'), ['W', 'W']],
      [t('hotkeys.flySpeed'), [t('hotkeys.keys.wheel')]],
      [t('hotkeys.releaseMouse'), ['Esc']],
    ],
  ],
  [
    t('hotkeys.sections.panels'),
    [
      [t('hotkeys.blockList'), ['M']],
      [t('hotkeys.fullscreen'), ['F']],
      [t('hotkeys.help'), ['?']],
      [t('hotkeys.pick'), [t('hotkeys.keys.click')]],
      [t('hotkeys.measure'), ['⇧', t('hotkeys.keys.drag')]],
      [t('hotkeys.clear'), ['Esc']],
    ],
  ],
];

export function HotkeysDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-[760px]">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{t('hotkeys.title')}</DialogTitle>
          <DialogDescription>
            <Trans i18nKey="hotkeys.reopen" components={{ kbd: <Kbd /> }} />
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pt-5 pb-6">
          <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {sections(t).map(([title, rows]) => (
              <section key={title}>
                <h3 className="mb-3 border-b pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {title}
                </h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {rows.map(([label, keys]) => (
                    <li key={label} className="flex items-center justify-between gap-3">
                      <span>{label}</span>
                      <KbdGroup className="shrink-0">
                        {keys.map((k, i) => (
                          <Kbd key={i}>{k}</Kbd>
                        ))}
                      </KbdGroup>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
