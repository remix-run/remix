/**
 * Normalized press events for pointer and keyboard input. A press is dispatched
 * when a pointer or keyboard Enter/Space is pressed down followed by a press up
 * without repeating.
 *
 * ```tsx
 * import { press } from 'remix/interaction/press'
 * on(button, {
 *   [press]: (event) => {
 *     console.log('pressed')
 *   },
 * })
 * ```
 */
export declare let press: "rmx:press";
/**
 * Normalized press down event for pointers and keyboard Enter/Space without
 * repeating.
 *
 * ```ts
 * import { pressDown } from 'remix/interaction/press'
 * on(button, {
 *   [pressDown]: (event) => {
 *     console.log('pressed down')
 *   },
 * })
 * ```
 */
export declare let pressDown: "rmx:press-down";
/**
 * Normalized press up event for pointers and keyboard Enter/Space without
 * repeating.
 *
 * ```ts
 * import { pressUp } from 'remix/interaction/press'
 * on(button, {
 *   [pressUp]: (event) => {
 *     console.log('pressed up')
 *   },
 * })
 * ```
 */
export declare let pressUp: "rmx:press-up";
/**
 * Dispatches when a press is held for 500ms. To prevent any `press` events from
 * dispatching after a long press, call `event.preventDefault()` on the long
 * press event.
 *
 * ```ts
 * on(button, {
 *   [longPress]: (event) => {
 *     console.log('long pressed')
 *     // cancel subsequent `press`/`pressUp` events
 *     event.preventDefault()
 *   },
 *   [press]: (event) => {
 *     console.log('pressed')
 *   },
 * })
 * ```
 */
export declare let longPress: "rmx:long-press";
/**
 * Dispatched when a press is cancelled by a pointer up outside of the target or
 * keyboard escape after a press down.
 *
 * ```ts
 * import { pressCancel } from 'remix/interaction/press'
 * on(button, {
 *   [pressCancel]: (event) => {
 *     console.log('press cancelled')
 *   },
 * })
 * ```
 */
export declare let pressCancel: "rmx:press-cancel";
declare global {
    interface HTMLElementEventMap {
        [press]: PressEvent;
        [pressDown]: PressEvent;
        [pressUp]: PressEvent;
        [longPress]: PressEvent;
        [pressCancel]: PressEvent;
    }
}
export declare class PressEvent extends Event {
    clientX: number;
    clientY: number;
    constructor(type: typeof press | typeof pressDown | typeof pressUp | typeof longPress | typeof pressCancel, init?: {
        clientX?: number;
        clientY?: number;
    });
}
