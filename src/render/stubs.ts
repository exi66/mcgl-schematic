// Texture for blocks outside the pool: a grey tile with the block id, 16×16 tiles of 32 px (tile = id).

export function makeStubAtlas(): HTMLCanvasElement {
  const tile = 32;
  const c = document.createElement('canvas');
  c.width = c.height = tile * 16;
  const g = c.getContext('2d')!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let id = 0; id < 256; id++) {
    const x = (id % 16) * tile;
    const y = Math.floor(id / 16) * tile;
    g.fillStyle = '#8a8a8a';
    g.fillRect(x, y, tile, tile);
    g.strokeStyle = '#5c5c5c';
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
    g.fillStyle = '#ffffff';
    g.font = `bold ${id >= 100 ? 12 : 14}px 'Geist Mono Variable', monospace`;
    g.fillText(String(id), x + tile / 2, y + tile / 2 + 1);
  }
  return c;
}
