import * as THREE from 'three';

/**
 * Resolves any CSS colour (`var(--primary)`, `oklch(…)`, `color-mix(…)`) to a three.js colour: the browser computes
 * it on a probe element, then a 1×1 canvas turns the result into sRGB bytes (three.js cannot parse oklch).
 */
export function cssColor(css: string, fallback = 0x4da3ff): THREE.Color {
  if (typeof document === 'undefined') return new THREE.Color(fallback);
  const probe = document.createElement('span');
  probe.style.color = css;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx || !computed) return new THREE.Color(fallback);
  ctx.fillStyle = computed;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

/**
 * Accent for lines in the scene (selection, schematic bounds): the theme's primary. In the dark theme primary is too
 * dark for thin lines on a dark background, so it is lightened there.
 */
export const accentColor = (_dark: boolean) => cssColor('var(--primary)');

export const accentHoverColor = (_dark: boolean) =>
  cssColor('color-mix(in oklab, var(--primary) 90%, var(--background))');
