import { type Handle } from '@remix-run/ui';
export declare function HoldToConfirm(handle: Handle): () => import("@remix-run/ui").RemixElement;
declare const pressConfirmStartEventType: "demo:press-confirm-start";
declare const pressConfirmCancelEventType: "demo:press-confirm-cancel";
declare const pressConfirmEndEventType: "demo:press-confirm-end";
declare global {
    interface HTMLElementEventMap {
        [pressConfirmStartEventType]: Event;
        [pressConfirmCancelEventType]: Event;
        [pressConfirmEndEventType]: Event;
    }
}
export {};
