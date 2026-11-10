import type { ElementProps, MixinFactory } from '@remix-run/component'

import { press as pressMixin } from './lib/press.ts'
import type { PressOptions } from './lib/press.ts'

export type { PressInfo, PressOptions } from './lib/press.ts'

/**
 * Activates the host on primary-button mouse press instead of on release, and optionally reports
 * the press lifecycle. Without `press()`, every Remix UI control activates on the native click.
 *
 * Early activation trades away the chance to drag off a control to cancel (WCAG 2.5.2 Pointer
 * Cancellation). Use it where acting on press is essential or easily reversible.
 *
 * The press dispatches a click on the host with the pointer's position and button, so checkboxes,
 * radios, buttons, submit and reset buttons, links, labels and `click` listeners behave as they do
 * for a click. That click is untrusted (`isTrusted` is `false`), and the real click that follows the
 * release is cancelled before it reaches the host or its descendants, though listeners on `window`
 * or `document` that capture still see it. Touch, pen, keyboard and assistive technology keep
 * the native click.
 *
 * ```tsx
 * <input type="checkbox" mix={press()} />
 * <button type="submit" mix={press()}>Save</button>
 * <button mix={[tabs.tab({ name: 'one' }), press()]}>One</button>
 * ```
 *
 * The lifecycle callbacks report presses, and change what they activate only for `onLongPress`. They fire for
 * primary-button pointer presses of every type and for Enter and Space on the focused host, also
 * with `activate: false`, and not on disabled hosts. `onPressEnd` follows every `onPressStart`
 * once with `cancelled`, and Escape cancels a press. `onLongPress` fires after `longPressDuration`
 * (500ms), consumes the press, and defers activation to release: the native click for the mouse, and
 * for Enter on a native button, link, or `summary` a click on the host when the key is released
 * (untrusted, like the early mouse click, and it relies on the transient user activation of the
 * keydown, which browsers keep for about five seconds). A long-press-only action needs an
 * alternative for assistive technology users who cannot hold a key.
 *
 * `activate: false` keeps the native click and only reports the lifecycle, for feedback such as a
 * pressed style or a ripple.
 *
 * ```tsx
 * <div
 *   tabIndex={0}
 *   mix={press({
 *     activate: false,
 *     onPressStart() {
 *       pressed = true
 *       handle.update()
 *     },
 *     onPressEnd() {
 *       pressed = false
 *       handle.update()
 *     },
 *   })}
 * />
 * ```
 */
export const press: MixinFactory<HTMLElement, [options?: PressOptions], ElementProps> = pressMixin
