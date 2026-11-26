import { describe, expect, it } from 'vitest';
import { isValidTerrainSize } from '../src/lib/texturepacks';

describe('isValidTerrainSize', () => {
  it('accepts standard 512x512 and HD square multiples', () => {
    expect(isValidTerrainSize(512, 512)).toBe(true);
    expect(isValidTerrainSize(1024, 1024)).toBe(true);
    expect(isValidTerrainSize(2048, 2048)).toBe(true);
  });

  it('rejects non-square, too small, or unaligned sizes', () => {
    expect(isValidTerrainSize(256, 256)).toBe(false);
    expect(isValidTerrainSize(512, 1024)).toBe(false);
    expect(isValidTerrainSize(513, 513)).toBe(false);
    expect(isValidTerrainSize(0, 0)).toBe(false);
    expect(isValidTerrainSize(4096, 4096)).toBe(false);
  });
});
