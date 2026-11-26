import { describe, expect, it } from 'vitest';
import { readUrlState, viewLink, type LinkState } from '../src/app/url';

const ROOT = 'https://exi66.github.io/mcgl-schematic/';
const base: LinkState = {
  view: 'orbit',
  slice: { enabled: false, axis: 'y', value: 0, isolate: false },
  camera: null,
  embed: false,
};

describe('url state', () => {
  it('round-trips the view through the link', () => {
    const link = viewLink(
      {
        ...base,
        url: 'https://example.com/a b.schematic',
        view: 'explore',
        slice: { enabled: true, axis: 'x', value: 4, isolate: true },
        camera: { pos: [1.234, 5, -6.789], at: [0, 0.5, 1], rot: 2 },
        embed: true,
        list: false,
        dark: true,
      },
      ROOT,
    );
    const u = new URL(link);
    expect(u.origin + u.pathname).toBe(ROOT);
    expect(readUrlState(u.search)).toEqual({
      url: 'https://example.com/a b.schematic',
      view: 'explore',
      slice: { axis: 'x', value: 4, isolate: true },
      camera: { pos: [1.23, 5, -6.79], at: [0, 0.5, 1], rot: 2 },
      embed: true,
      list: false,
      dark: true,
    });
  });

  it('leaves defaults out', () => {
    expect(viewLink({ ...base, url: './examples/all-blocks.schematic' }, ROOT)).toBe(
      `${ROOT}?url=.%2Fexamples%2Fall-blocks.schematic`,
    );
  });

  it('keeps only the layout for files from disk', () => {
    expect(viewLink({ ...base, view: 'plan', embed: true }, ROOT)).toBe(`${ROOT}?embed=1`);
  });

  it('reads old names', () => {
    expect(readUrlState('?view=top&y=3')).toEqual({ view: 'plan', slice: { axis: 'y', value: 2, isolate: false } });
  });
});
