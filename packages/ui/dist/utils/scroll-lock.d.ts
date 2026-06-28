import { type ElementProps, type MixinFactory } from '@remix-run/ui';
export declare function lockScroll(targetDocument?: Document | undefined): () => void;
export declare const lockScrollOnToggle: MixinFactory<HTMLElement, [], ElementProps>;
