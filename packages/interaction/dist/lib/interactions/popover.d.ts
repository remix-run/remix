/**
 * ### Description
 *
 * Dispatches on the owner of a popover when the popover toggles.
 *
 * ### Example
 *
 * ```html
 * <button popovertarget="my-popover">
 *   Toggle Popover
 * </button>
 * <div id="my-popover" popover>
 *   <p>Hello, world!</p>
 * </div>
 * ```
 *
 * ```ts
 * import { popoverToggle } from 'remix/interaction/popover'
 * on(button, {
 *   [popoverToggle](event) {
 *     console.log('I am not the popover but the owner')
 *     console.log(event.newState) // 'open' or 'closed'
 *     console.log(event.oldState) // 'open' or 'closed'
 *   },
 * })
 * ```
 */
export declare let popoverToggle: "rmx:popover-toggle";
/**
 * ### Description
 *
 * Dispatches on the owner of a popover before the popover toggles.
 *
 * ### Example
 *
 * ```html
 * <button popovertarget="my-popover">
 *   Toggle Popover
 * </button>
 * <div id="my-popover" popover>
 *   <p>Hello, world!</p>
 * </div>
 * ```
 * ```ts
 * import { popoverToggle } from 'remix/interaction/popover'
 * on(button, {
 *   [beforePopoverToggle](event) {
 *     console.log('I am not the popover but the owner')
 *     console.log(event.newState) // 'open' or 'closed'
 *     console.log(event.oldState) // 'open' or 'closed'
 *   },
 * })
 * ```
 */
export declare let beforePopoverToggle: "rmx:before-popover-toggle";
declare global {
    interface HTMLElementEventMap {
        [popoverToggle]: ToggleEvent;
        [beforePopoverToggle]: ToggleEvent;
    }
}
