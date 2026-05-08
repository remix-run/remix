import type { ElementProps } from '../jsx.ts';
/**
 * Callback invoked with the bound node and a lifetime signal.
 */
export type RefCallback<node extends EventTarget> = (node: node, signal: AbortSignal) => void;
/**
 * Calls a callback when an element is inserted and aborts it when removed.
 */
export declare const ref: <boundNode extends Element = Element>(callback: (node: boundNode, signal: AbortSignal) => void) => import("./mixin.ts").MixinDescriptor<boundNode, [callback: (node: boundNode, signal: AbortSignal) => void], ElementProps>;
