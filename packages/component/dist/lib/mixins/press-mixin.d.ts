export declare const pressEventType: "rmx:press";
export declare const pressDownEventType: "rmx:press-down";
export declare const pressUpEventType: "rmx:press-up";
export declare const longPressEventType: "rmx:long-press";
export declare const pressCancelEventType: "rmx:press-cancel";
declare global {
    interface HTMLElementEventMap {
        [pressEventType]: PressEvent;
        [pressDownEventType]: PressEvent;
        [pressUpEventType]: PressEvent;
        [longPressEventType]: PressEvent;
        [pressCancelEventType]: PressEvent;
    }
}
/**
 * Event emitted by the {@link pressEvents} mixin for pointer and keyboard presses.
 */
export declare class PressEvent extends Event {
    /**
     * The horizontal pointer coordinate for the press event.
     */
    clientX: number;
    /**
     * The vertical pointer coordinate for the press event.
     */
    clientY: number;
    constructor(type: typeof pressEventType | typeof pressDownEventType | typeof pressUpEventType | typeof longPressEventType | typeof pressCancelEventType, init?: {
        clientX?: number;
        clientY?: number;
    });
}
declare const basePressEvents: <boundNode extends HTMLElement = HTMLElement>() => import("../mixin.ts").MixinDescriptor<boundNode, [], import("@remix-run/component/jsx-runtime").ElementProps>;
type PressEventsMixin = typeof basePressEvents & {
    readonly press: typeof pressEventType;
    readonly down: typeof pressDownEventType;
    readonly up: typeof pressUpEventType;
    readonly long: typeof longPressEventType;
    readonly cancel: typeof pressCancelEventType;
};
/**
 * Normalizes pointer and keyboard input into press lifecycle events.
 */
export declare const pressEvents: PressEventsMixin;
export {};
