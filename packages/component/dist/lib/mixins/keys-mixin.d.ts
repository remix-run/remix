export declare let escapeEventType: "keydown:Escape";
export declare let enterEventType: "keydown:Enter";
export declare let spaceEventType: "keydown: ";
export declare let backspaceEventType: "keydown:Backspace";
export declare let deleteEventType: "keydown:Delete";
export declare let arrowLeftEventType: "keydown:ArrowLeft";
export declare let arrowRightEventType: "keydown:ArrowRight";
export declare let arrowUpEventType: "keydown:ArrowUp";
export declare let arrowDownEventType: "keydown:ArrowDown";
export declare let homeEventType: "keydown:Home";
export declare let endEventType: "keydown:End";
export declare let pageUpEventType: "keydown:PageUp";
export declare let pageDownEventType: "keydown:PageDown";
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
declare let baseKeysEvents: <boundNode extends HTMLElement = HTMLElement>() => import("../mixin.ts").MixinDescriptor<boundNode, [], import("@remix-run/component/jsx-runtime").ElementProps>;
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
export declare let keysEvents: KeysEventsMixin;
export {};
