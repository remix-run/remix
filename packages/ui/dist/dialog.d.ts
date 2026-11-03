import { on, type Dispatched, type ElementProps, type Handle, type MixinFactory, type RemixNode } from '@remix-run/component';
declare const DIALOG_CHANGE_EVENT: 'rmx:dialog-change';
/** The interaction that requested a dialog state change. */
export type DialogChangeReason = 'trigger' | 'close' | 'escape-key' | 'outside-click' | 'focus-out' | 'programmatic';
/** Modal behavior for a dialog. `trap-focus` allows outside pointer interaction and scrolling. */
export type DialogModal = boolean | 'trap-focus';
/** A focus target, a default-behavior flag, or a callback evaluated when focus moves. */
export type DialogFocusTarget = HTMLElement | boolean | null | (() => HTMLElement | boolean | null | undefined);
/** A cancelable open-state request, dispatched from the dialog surface. */
export declare class DialogChangeEvent extends Event {
    /** The requested open state. */
    readonly open: boolean;
    /** The interaction that requested the change. */
    readonly reason: DialogChangeReason;
    /** The original browser event, when the request came from an interaction. */
    readonly sourceEvent: Event | undefined;
    constructor(open: boolean, reason: DialogChangeReason, sourceEvent?: Event);
}
declare global {
    interface HTMLElementEventMap {
        [DIALOG_CHANGE_EVENT]: DialogChangeEvent;
    }
}
/** Imperative access to one dialog instance, including triggers outside its context. */
export type DialogRef = {
    /** Whether the dialog is open. */
    readonly open: boolean;
    /** Opens the dialog and optionally records its opener for focus restoration. */
    show(trigger?: HTMLElement): void;
    /** Requests that the dialog close. */
    close(): void;
};
/** State and interaction options for `dialog.Context`. */
export type DialogContextProps = {
    /** Dialog parts and app-owned content. */
    children?: RemixNode;
    /** Controlled open state. */
    open?: boolean;
    /** Initial uncontrolled open state. Defaults to false. */
    defaultOpen?: boolean;
    /** Whether to block outside interaction, trap only focus, or allow both. Defaults to true. */
    modal?: DialogModal;
    /** Whether Escape requests a close. Defaults to true. */
    closeOnEscape?: boolean;
    /** Whether outside clicks and non-modal focus departure request a close. Defaults to true. */
    closeOnOutsideClick?: boolean;
    /** Receives open-state requests. Call `event.preventDefault()` to cancel one. */
    onOpenChange?: (open: boolean, event: DialogChangeEvent) => void;
    /** Called after the surface and backdrop finish their finite animations and transitions. */
    onOpenChangeComplete?: (open: boolean) => void;
    /** Receives a stable imperative ref once after the first render. */
    ref?: (dialog: DialogRef) => void;
};
/** Focus options for a dialog surface. */
export type DialogSurfaceOptions = {
    /** Initial focus target. Defaults to the registered target, first tabbable element, or surface. */
    initialFocus?: DialogFocusTarget;
    /** Closing focus target. Defaults to the registered target, opener, or previously focused element. */
    finalFocus?: DialogFocusTarget;
};
type DialogContextValue = {
    readonly open: boolean;
    readonly modal: DialogModal;
    readonly nested: boolean;
    readonly parentSurface: HTMLElement | null;
    readonly closeOnEscape: boolean;
    readonly closeOnOutsideClick: boolean;
    readonly surfaceId: string;
    readonly titleId: string;
    readonly descriptionId: string;
    surface: HTMLElement | null;
    backdrop: HTMLElement | null;
    trigger: HTMLElement | null;
    triggers: Set<HTMLElement>;
    openingEvent: Event | undefined;
    closingReason: DialogChangeReason | undefined;
    showFocusTarget: HTMLElement | null;
    hideFocusTarget: HTMLElement | null;
    isTrigger(target: Node): boolean;
    request(open: boolean, reason: DialogChangeReason, event?: Event, trigger?: HTMLElement): boolean;
    complete(open: boolean): void;
    syncBackdrop(): void;
};
declare function DialogProvider(handle: Handle<DialogContextProps, DialogContextValue>): () => RemixNode;
/** Provides state and registration for one dialog. */
export declare const Context: typeof DialogProvider;
/** Adapts a native button to open or toggle its dialog. */
export declare const trigger: MixinFactory<HTMLButtonElement, [], ElementProps>;
/** Adapts an app-owned element to the dialog surface. */
export declare const surface: MixinFactory<HTMLElement, [options?: DialogSurfaceOptions | undefined], ElementProps>;
/** Registers an optional, app-styled backdrop below the surface. */
export declare const backdrop: MixinFactory<HTMLElement, [], ElementProps>;
/** Adapts a native button to request closing its dialog. */
export declare const close: MixinFactory<HTMLButtonElement, [], ElementProps>;
/** Associates a heading with the dialog's accessible name. */
export declare const title: MixinFactory<HTMLElement, [], ElementProps>;
/** Associates text with the dialog's accessible description. */
export declare const description: MixinFactory<HTMLElement, [], ElementProps>;
/** Registers the initial focus target inside the dialog. */
export declare const focusOnShow: MixinFactory<HTMLElement, [], ElementProps>;
/** Registers a focus return target, overriding the opener. */
export declare const focusOnHide: MixinFactory<HTMLElement, [], ElementProps>;
/**
 * Handles bubbling, cancelable dialog open-state requests.
 * @param handler The event handler.
 * @param captureBoolean Whether to listen during capture.
 * @returns An event mixin for the host element.
 */
export declare function onDialogChange<target extends HTMLElement>(handler: (event: Dispatched<DialogChangeEvent, target>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof DIALOG_CHANGE_EVENT>>;
export {};
