import type { Plugin } from './api';

export type { BlockAction, BlockRef, Plugin, PluginHost, PluginPanelProps } from './api';

/** Registered plugins. Add a plugin here (see api.ts for the contract and the planned BAK particle plugin). */
export const PLUGINS: readonly Plugin[] = [];
