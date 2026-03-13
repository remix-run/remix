import type { ElementProps } from '../jsx.ts';
export type RefCallback<node extends EventTarget> = (node: node, signal: AbortSignal) => void;
export declare let ref: <boundNode extends Element = Element>(callback: (node: boundNode, signal: AbortSignal) => void) => import("../mixin.ts").MixinDescriptor<boundNode, [callback: (node: boundNode, signal: AbortSignal) => void], ElementProps>;
