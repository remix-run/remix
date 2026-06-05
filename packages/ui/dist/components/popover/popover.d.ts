import { type CSSMixinDescriptor, type ElementProps, type Handle, type MixinFactory, type RemixNode } from '@remix-run/ui';
import { type AnchorOptions, type AnchorTarget } from '../anchor/anchor.ts';
export interface PopoverContext {
    hideFocusTarget: HTMLElement | null;
    showFocusTarget: HTMLElement | null;
    surface: HTMLElement | null;
    anchor: AnchorRef | null;
}
export interface PopoverProps {
    children?: RemixNode;
}
interface AnchorRef {
    target: AnchorTarget;
    options: AnchorOptions;
}
export declare const contentStyle: CSSMixinDescriptor;
export declare const surfaceStyle: readonly [CSSMixinDescriptor, CSSMixinDescriptor];
declare function PopoverProvider(handle: Handle<PopoverProps, PopoverContext>): () => RemixNode;
export interface PopoverSurfaceOptions {
    open: boolean;
    onHide: (request?: PopoverHideRequest) => void;
    closeOnAnchorClick?: boolean;
    restoreFocusOnHide?: boolean;
    stopOutsideClickPropagation?: boolean;
}
export interface PopoverHideRequest {
    reason: 'escape-key' | 'outside-click';
    target?: Node | null;
}
export declare const Context: typeof PopoverProvider;
export declare const anchor: MixinFactory<HTMLElement, [options: AnchorOptions], ElementProps>;
export declare const surface: MixinFactory<HTMLElement, [options: PopoverSurfaceOptions], ElementProps>;
export declare const focusOnHide: MixinFactory<HTMLElement, [], ElementProps>;
export declare const focusOnShow: MixinFactory<HTMLElement, [], ElementProps>;
export {};
