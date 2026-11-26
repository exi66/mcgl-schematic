import { cn } from '@/lib/utils';

/** The app's cube (same shape as favicon.svg) in the theme's primary colour: right face primary, left darker, top lighter. */
export function CubeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-6 shrink-0', className)}>
      <path fill="var(--primary)" d="M16 2 29 9v14l-13 7-13-7V9z" />
      <path fill="color-mix(in oklab, var(--primary) 70%, black)" d="M16 16v14L3 23V9z" />
      <path fill="color-mix(in oklab, var(--primary) 55%, white)" d="M16 2 29 9l-13 7L3 9z" />
    </svg>
  );
}
