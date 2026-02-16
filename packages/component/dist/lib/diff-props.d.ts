import type { StyleManager } from './style/index.ts';
import type { ElementProps } from './jsx.ts';
export { type StyleManager };
export declare let defaultStyleManager: StyleManager;
export declare function cleanupCssProps(props: ElementProps | undefined, styles?: StyleManager): void;
export declare function diffHostProps(curr: ElementProps, next: ElementProps, dom: Element, styles?: StyleManager): void;
/**
 * Reset the global style state. For testing only - not exported from index.ts.
 */
export declare function resetStyleState(): void;
