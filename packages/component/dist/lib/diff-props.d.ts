import type { ElementProps } from './jsx.ts';
export declare function cleanupCssProps(props: ElementProps | undefined): void;
export declare function diffHostProps(curr: ElementProps, next: ElementProps, dom: Element): void;
/**
 * Reset the global style state. For testing only - not exported from index.ts.
 */
export declare function resetStyleState(): void;
