import { type ElementProps } from '@remix-run/ui';
export declare function lockScroll(targetDocument?: Document): () => void;
export declare const lockScrollOnToggle: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/ui").MixinDescriptor<boundNode, [], ElementProps>;
