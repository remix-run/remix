import { type ElementProps } from '@remix-run/component';
export declare function lockScroll(targetDocument?: Document): () => void;
export declare const lockScrollOnToggle: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
