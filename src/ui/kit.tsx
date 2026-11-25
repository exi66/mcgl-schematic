// Small shadcn-style components (Tailwind + Radix primitives).

import { clsx, type ClassValue } from 'clsx';
import {
  Dialog as DialogPrimitive,
  Popover as PopoverPrimitive,
  ScrollArea as ScrollAreaPrimitive,
  Slider as SliderPrimitive,
  Switch as SwitchPrimitive,
  ToggleGroup as ToggleGroupPrimitive,
  Tooltip as TooltipPrimitive,
} from 'radix-ui';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

type ButtonVariant = 'default' | 'outline' | 'ghost';
const buttonVariants: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  outline: 'border bg-card hover:bg-muted',
  ghost: 'hover:bg-muted',
};

export function Button({
  className,
  variant = 'default',
  size = 'md',
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'icon' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        size === 'sm' && 'h-8 px-2.5',
        size === 'md' && 'h-9 px-3',
        size === 'icon' && 'size-8',
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Slider({ className, orientation, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  const vertical = orientation === 'vertical';
  return (
    <SliderPrimitive.Root
      orientation={orientation}
      className={cn(
        'relative flex touch-none items-center select-none',
        vertical ? 'h-full w-5 flex-col px-2' : 'w-full py-2',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn('relative grow overflow-hidden rounded-full bg-muted', vertical ? 'w-1.5' : 'h-1.5 w-full')}
      >
        <SliderPrimitive.Range className={cn('absolute bg-primary', vertical ? 'w-full' : 'h-full')} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={props['aria-label'] ?? 'Значение'}
        className="block size-4 rounded-full border-2 border-primary bg-card shadow"
      />
    </SliderPrimitive.Root>
  );
}

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-muted transition-colors data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-card shadow transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode; title?: string }[];
  className?: string;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className={cn('inline-flex w-full rounded-md border bg-muted p-0.5', className)}
    >
      {items.map((it) => (
        <ToggleGroupPrimitive.Item
          key={it.value}
          value={it.value}
          title={it.title}
          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-[5px] px-2 text-xs font-medium text-muted-foreground transition-colors data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm [&_svg]:size-3.5"
        >
          {it.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-64 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(760px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border bg-popover text-popover-foreground shadow-xl outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
              aria-label="Закрыть"
            >
              <X />
            </DialogPrimitive.Close>
          </div>
          <div className="px-5 pt-5 pb-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center border bg-muted px-1.5 font-mono text-[11px] font-medium shadow-[0_1px_0_var(--border)]">
      {children}
    </kbd>
  );
}

/** shadcn ScrollArea: native scrolling with a thin custom scrollbar. */
export function ScrollArea({
  className,
  viewportClassName,
  children,
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Root> & { viewportClassName?: string }) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn('relative overflow-hidden', className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn('size-full [&>div]:!block', viewportClassName)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 bg-border hover:bg-muted-foreground/40"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}
