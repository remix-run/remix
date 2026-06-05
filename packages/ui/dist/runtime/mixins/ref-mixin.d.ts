import { type MixinFactory } from './mixin.ts';
import type { ElementProps } from '../jsx.ts';
/**
 * Callback invoked with the bound node and a lifetime signal.
 */
export type RefCallback<node extends EventTarget> = (node: node, signal: AbortSignal) => void;
/**
 * Calls a callback when an element is inserted and aborts it when removed.
 */
export declare const ref: MixinFactory<Element, [callback: RefCallback<Element>], ElementProps>;
