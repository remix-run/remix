type PointerClickEvent = PointerEvent | MouseEvent;
export declare const onPointerDownClick: <boundNode extends HTMLElement = HTMLElement>(handler: (event: PointerClickEvent) => void) => import("@remix-run/component").MixinDescriptor<boundNode, [handler: (event: PointerClickEvent) => void], import("@remix-run/component").ElementProps>;
export declare const onPointerUpClick: <boundNode extends HTMLElement = HTMLElement>(handler: (event: PointerClickEvent) => void) => import("@remix-run/component").MixinDescriptor<boundNode, [handler: (event: PointerClickEvent) => void], import("@remix-run/component").ElementProps>;
export {};
