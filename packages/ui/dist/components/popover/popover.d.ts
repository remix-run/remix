import { type CSSMixinDescriptor, type Handle, type RemixNode } from '@remix-run/ui';
import { type AnchorOptions } from '../anchor/anchor.ts';
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
    node: HTMLElement;
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
export declare const anchor: <boundNode extends HTMLElement = HTMLElement>(options: AnchorOptions) => import("@remix-run/ui").MixinDescriptor<boundNode, [options: AnchorOptions], import("@remix-run/ui").ElementProps>;
export declare const surface: <boundNode extends HTMLElement = HTMLElement>(options: PopoverSurfaceOptions) => import("@remix-run/ui").MixinDescriptor<boundNode, [options: PopoverSurfaceOptions], import("@remix-run/ui").ElementProps>;
export declare const focusOnHide: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/ui").MixinDescriptor<boundNode, [], import("@remix-run/ui").ElementProps>;
export declare const focusOnShow: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/ui").MixinDescriptor<boundNode, [], import("@remix-run/ui").ElementProps>;
export {};
