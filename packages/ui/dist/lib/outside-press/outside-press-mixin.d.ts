import { type ElementProps } from '@remix-run/component';
export type OutsidePressEvent = PointerEvent & {
    currentTarget: HTMLElement;
};
export type OutsidePressHandler = (event: OutsidePressEvent) => void;
export declare const onOutsidePress: <boundNode extends HTMLElement = HTMLElement>(handler: (event: OutsidePressEvent) => void) => import("@remix-run/component").MixinDescriptor<boundNode, [handler: (event: OutsidePressEvent) => void], ElementProps>;
