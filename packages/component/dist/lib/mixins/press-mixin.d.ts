export declare let pressEventType: "rmx:press";
export declare let pressDownEventType: "rmx:press-down";
export declare let pressUpEventType: "rmx:press-up";
export declare let longPressEventType: "rmx:long-press";
export declare let pressCancelEventType: "rmx:press-cancel";
declare global {
    interface HTMLElementEventMap {
        [pressEventType]: PressEvent;
        [pressDownEventType]: PressEvent;
        [pressUpEventType]: PressEvent;
        [longPressEventType]: PressEvent;
        [pressCancelEventType]: PressEvent;
    }
}
export declare class PressEvent extends Event {
    clientX: number;
    clientY: number;
    constructor(type: typeof pressEventType | typeof pressDownEventType | typeof pressUpEventType | typeof longPressEventType | typeof pressCancelEventType, init?: {
        clientX?: number;
        clientY?: number;
    });
}
declare let basePressEvents: <boundNode extends HTMLElement = HTMLElement>() => import("../mixin.ts").MixinDescriptor<boundNode, [], import("@remix-run/component/jsx-runtime").ElementProps>;
type PressEventsMixin = typeof basePressEvents & {
    readonly press: typeof pressEventType;
    readonly down: typeof pressDownEventType;
    readonly up: typeof pressUpEventType;
    readonly long: typeof longPressEventType;
    readonly cancel: typeof pressCancelEventType;
};
export declare let pressEvents: PressEventsMixin;
export {};
