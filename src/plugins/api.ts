// Plugin contract. A plugin adds tools on top of the schematic: actions for a selected block, a panel opened by
// an action, and its own 3D layer in the scene. Plugins are registered in ./index.ts.
//
// Planned first plugin: BAK particle — "Запустить частицу" on a terminal (160): checks the assembly, finds the
// particle source, flies the particle
// and draws its path, laps, uranium cost, speed and reaction or the reason it died.

import type { ComponentType, ReactNode } from 'react';
import type { Object3D } from 'three';
import type { Schematic } from '../schematic/schematic';

/** A block of the schematic: position (schematic coordinates), id and metadata. */
export interface BlockRef {
  x: number;
  y: number;
  z: number;
  id: number;
  meta: number;
}

/** What the app gives a plugin. */
export interface PluginHost {
  readonly schematic: Schematic;
  /** Block at a cell; id 0 — air or outside the schematic. */
  block(x: number, y: number, z: number): { id: number; meta: number };
  /** Shows, replaces or clears (null) this plugin's 3D layer in the scene. */
  setOverlay(object: Object3D | null): void;
}

/** An action offered in the card of the selected block. */
export interface BlockAction {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface PluginPanelProps {
  host: PluginHost;
  /** The block the action was started on. */
  block: BlockRef;
  /** The action id. */
  action: string;
  /** Closes the panel; the app clears the plugin's 3D layer. */
  onClose: () => void;
}

export interface Plugin {
  /** Stable id, e.g. "bak-particle". */
  id: string;
  name: string;
  /** Actions for the selected block (empty — none). */
  blockActions?(block: BlockRef, host: PluginHost): BlockAction[];
  /** Panel shown after an action is picked. */
  Panel?: ComponentType<PluginPanelProps>;
}
