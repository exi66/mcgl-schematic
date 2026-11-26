import { useCallback, useLayoutEffect, useState } from 'react';

/**
 * Same storage as the starter's ThemeProvider: localStorage `theme` = `light | dark | system` (a plain string),
 * shared by every project on the domain, so the choice follows the user. The inline script in index.html applies it
 * before the first paint.
 */
const KEY = 'theme';
/** Where this app kept the theme before the starter (JSON boolean). Read once and moved to `theme`. */
const LEGACY_KEY = 'theme-dark';

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

function readSaved(): boolean | undefined {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark') return true;
    if (v === 'light') return false;
    if (v === 'system') return undefined;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'true' || legacy === 'false') {
      localStorage.setItem(KEY, legacy === 'true' ? 'dark' : 'light');
      localStorage.removeItem(LEGACY_KEY);
      return legacy === 'true';
    }
  } catch {
    /* storage unavailable */
  }
  return undefined;
}

/**
 * Dark theme on/off. `override` (the link's `theme`) wins for this page and is not saved; the third value says it is
 * still in force. Toggling saves the choice and ends the override.
 */
export function useDarkTheme(override?: boolean): [boolean, (v: boolean | ((p: boolean) => boolean)) => void, boolean] {
  const [dark, setDarkState] = useState(() => override ?? readSaved() ?? systemDark());
  const [overridden, setOverridden] = useState(override !== undefined);

  // Layout effect: the class must be on <html> before the viewer (a child's passive effect) reads the theme colours.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
  }, [dark]);

  const setDark = useCallback((next: boolean | ((p: boolean) => boolean)) => {
    setOverridden(false);
    setDarkState((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem(KEY, v ? 'dark' : 'light');
      } catch {
        /* ignore */
      }
      return v;
    });
  }, []);

  return [dark, setDark, overridden];
}
