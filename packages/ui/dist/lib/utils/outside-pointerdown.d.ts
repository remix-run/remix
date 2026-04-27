type OutsidePointerDownEvent = PointerEvent | MouseEvent;
export declare const onOutsidePointerDown: <boundNode extends HTMLElement = HTMLElement>(handler: (event: OutsidePointerDownEvent) => void) => import("@remix-run/component").MixinDescriptor<boundNode, [handler: (event: OutsidePointerDownEvent) => void], import("@remix-run/component").ElementProps>;
export {};
