export declare const escapeEventType: "keydown:Escape";
export declare const enterEventType: "keydown:Enter";
export declare const spaceEventType: "keydown: ";
export declare const backspaceEventType: "keydown:Backspace";
export declare const deleteEventType: "keydown:Delete";
export declare const arrowLeftEventType: "keydown:ArrowLeft";
export declare const arrowRightEventType: "keydown:ArrowRight";
export declare const arrowUpEventType: "keydown:ArrowUp";
export declare const arrowDownEventType: "keydown:ArrowDown";
export declare const homeEventType: "keydown:Home";
export declare const endEventType: "keydown:End";
export declare const pageUpEventType: "keydown:PageUp";
export declare const pageDownEventType: "keydown:PageDown";
declare global {
    interface HTMLElementEventMap {
        [escapeEventType]: KeyboardEvent;
        [enterEventType]: KeyboardEvent;
        [spaceEventType]: KeyboardEvent;
        [backspaceEventType]: KeyboardEvent;
        [deleteEventType]: KeyboardEvent;
        [arrowLeftEventType]: KeyboardEvent;
        [arrowRightEventType]: KeyboardEvent;
        [arrowUpEventType]: KeyboardEvent;
        [arrowDownEventType]: KeyboardEvent;
        [homeEventType]: KeyboardEvent;
        [endEventType]: KeyboardEvent;
        [pageUpEventType]: KeyboardEvent;
        [pageDownEventType]: KeyboardEvent;
    }
}
declare const baseKeysEvents: <boundNode extends HTMLElement = HTMLElement>() => import("../mixin.ts").MixinDescriptor<boundNode, [], import("@remix-run/component/jsx-runtime").ElementProps>;
type KeysEventsMixin = typeof baseKeysEvents & {
    readonly escape: typeof escapeEventType;
    readonly enter: typeof enterEventType;
    readonly space: typeof spaceEventType;
    readonly backspace: typeof backspaceEventType;
    readonly del: typeof deleteEventType;
    readonly arrowLeft: typeof arrowLeftEventType;
    readonly arrowRight: typeof arrowRightEventType;
    readonly arrowUp: typeof arrowUpEventType;
    readonly arrowDown: typeof arrowDownEventType;
    readonly home: typeof homeEventType;
    readonly end: typeof endEventType;
    readonly pageUp: typeof pageUpEventType;
    readonly pageDown: typeof pageDownEventType;
};
/**
 * Normalizes common keyboard keys into custom key-specific DOM events.
 */
export declare const keysEvents: KeysEventsMixin;
export {};
