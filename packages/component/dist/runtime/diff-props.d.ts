import type { StyleManager } from '../style/index.ts';
export { type StyleManager };
export { patchHostProps as diffHostProps } from './core/props.ts';
export declare let defaultStyleManager: StyleManager;
/**
 * Reset the global style state. For testing only - not exported from index.ts.
 */
export declare function resetStyleState(): void;
