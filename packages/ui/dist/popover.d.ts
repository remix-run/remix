import { type ElementProps, type Handle, type MixinFactory, type RemixNode } from '@remix-run/component';
import { type AnchorOptions, type AnchorTarget } from './anchor.ts';
export type PopoverContext = {
    hideFocusTarget: HTMLElement | null;
    showFocusTarget: HTMLElement | null;
    surface: HTMLElement | null;
    anchor: AnchorRef | null;
};
export type PopoverProps = {
    children?: RemixNode;
};
type AnchorRef = {
    /** Element that owns a popup positioned at viewport coordinates. */
    source?: HTMLElement;
    target: AnchorTarget;
    options: AnchorOptions;
};
declare function PopoverProvider(handle: Handle<PopoverProps, PopoverContext>): () => RemixNode;
export type PopoverSurfaceOptions = {
    open: boolean;
    onHide: (request?: PopoverHideRequest) => void;
    closeOnAnchorClick?: boolean;
    restoreFocusOnHide?: boolean;
    stopOutsideClickPropagation?: boolean;
};
export type PopoverHideRequest = {
    reason: 'escape-key' | 'outside-click';
    target?: Node | null;
};
export declare const Context: typeof PopoverProvider;
export declare const anchor: MixinFactory<HTMLElement, [options: AnchorOptions], ElementProps>;
export declare const surface: MixinFactory<HTMLElement, [options: PopoverSurfaceOptions], ElementProps>;
export declare const focusOnHide: MixinFactory<HTMLElement, [], ElementProps>;
export declare const focusOnShow: MixinFactory<HTMLElement, [], ElementProps>;
export {};
