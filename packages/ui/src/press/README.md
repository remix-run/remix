# press

Every Remix UI control activates on the native click, on release, so a press can be cancelled by dragging off before release. `press` opts a host into activating on primary mouse button press instead, and reports the press lifecycle for feedback such as pressed styles, ripples, and hold gestures.

Early activation trades away drag-off-to-cancel, which [WCAG 2.5.2 Pointer Cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html) (Level A) asks for. Use it only where acting on press is essential or easily reversible, and leave destructive actions on the click.

## Usage

```tsx
import { press } from '@remix-run/ui/press'

function Preferences() {
  return () => (
    <form>
      <label mix={press()}>
        <input type="checkbox" name="email" />
        Email notifications
      </label>
      <button type="submit" mix={press()}>
        Save
      </button>
    </form>
  )
}
```

Keep existing `click` listeners and native behavior as they are. `press()` only changes when the click happens.

## `@remix-run/ui/press`

- `press(options?)`: on a primary-button mouse `pointerdown` it dispatches a click on the host, then cancels the click that follows the release. The optional [lifecycle callbacks](#press-lifecycle) report presses, and `activate: false` keeps the native click.

## Composing with Remix UI

`press()` composes with any host. Add it next to the primitive's mixin on the element that should activate on press:

```tsx
<button mix={[tabs.tab({ name: 'account' }), press()]}>Account</button>
<input type="checkbox" mix={[toggle(), press()]} />
<div mix={[select.option({ label: 'Remix', value: 'remix' }), press()]}>Remix</div>
<div mix={[menu.item({ name: 'rename' }), press()]}>Rename</div>
<button mix={[dialog.trigger(), press()]}>Edit</button>
<button mix={[dialog.close(), press()]}>Close</button>
<button mix={[popover.anchor({ placement: 'bottom-start' }), press(), on('click', toggle)]}>Open</button>
<label mix={[form.label(field), press()]}>Name</label>
```

`dialog.trigger()`, `dialog.close()`, and `popover.anchor()` (with a `focusOnShow()` target) keep a mouse press from moving focus to the button after the overlay has taken it, so they work with `press()`. A plain `<label>` that wraps or points at a `press()` control activates it on press too.

## Select and menu triggers

Select and menu triggers are the one exception: they open on primary-button mouse press by default, like native menus, with no `press()`. Pressing, dragging at least 10px, and releasing over an option or item commits it in one gesture. A release over the trigger leaves the popup open. The trigger opens directly, without a click, so it produces no untrusted click, and the click that trails the press is ignored. Touch, pen, and keyboard open on the click as usual.

In an open select or menu, an item commits on release, never on press. A mouse press that starts on one item and is released over another commits the item under the release, and a release outside the list commits nothing.

## Press lifecycle

`onPressStart`, `onPressEnd`, and `onLongPress` follow a press for pressed visuals, ripples, and hold gestures. They replace hand-rolled `pointerdown`, `pointerup`, `pointerleave`, `keydown`, `keyup`, and `blur` handlers.

```tsx
import { press } from '@remix-run/ui/press'

function HoldToDelete(handle: Handle<{ onDelete(): void }>) {
  let holding = false

  return () => (
    <button
      type="button"
      mix={press({
        longPressDuration: 2000,
        onPressStart() {
          holding = true
          handle.update()
        },
        onPressEnd() {
          holding = false
          handle.update()
        },
        onLongPress() {
          handle.props.onDelete()
        },
      })}
    >
      {holding ? 'Keep holding…' : 'Hold to delete'}
    </button>
  )
}
```

- `onPressStart(press)` runs when a primary-button pointer press (mouse, touch, or pen) or an Enter or Space key press starts on the host, before any activation. `press` has `clientX`, `clientY`, and `pointerType` (`'mouse'`, `'pen'`, `'touch'`, or `'keyboard'`). Keyboard presses report the center of the host.
- `onPressEnd(press)` runs once for every `onPressStart`, with `press.cancelled`. It is `false` when the press is released over the host, and `true` when the pointer left the host, the browser cancelled the pointer (such as a scroll), the host lost focus, Escape was pressed, or a long press consumed the press. Its coordinates are those of the release.
- `onLongPress(press)` runs once when the press has been held for `longPressDuration` milliseconds (default `500`). It consumes the press: the release ends with `cancelled: true` and nothing is activated. A host with `onLongPress` activates on release for every input, since an early activation could not be taken back: the mouse on click, and Enter on a native `button`, `a[href]`, `summary`, or `input` of type `button`, `submit`, `reset`, `image`, `color`, or `file`. See [Enter and long press](#enter-and-long-press).
- `activate: false` keeps the native click for every pointer and only reports the lifecycle. Use it for feedback such as a pressed style or a ripple, where early activation isn't intended. Without it, a mouse press still activates the host on press, touch, pen, and keyboard keep the native click, and a host that never activates, such as a focusable `div`, can still be pressed. Space on a host that does not activate natively (not a `button`, `input`, `select`, or `summary`) does not scroll the page.
- Secondary buttons, modifier presses, non-primary pointers, and `:disabled` or `[aria-disabled="true"]` hosts are not pressed. Key events from inside the host (such as a nested input) do not start a press. Removing the host ends the press without calling `onPressEnd`.
- Callbacks read the latest options on every press, so they can close over render state.

Migrating hand-rolled handlers: `pointerdown` and the Enter or Space `keydown` become `onPressStart`; `pointerup`, `pointercancel`, `pointerleave`, the Enter or Space `keyup`, and `blur` become `onPressEnd`; a `setTimeout` started on press and cleared on release becomes `onLongPress` with `longPressDuration`. Drop the `isPrimary`, `event.repeat`, and key checks, and the `preventDefault()` on Space.

## Enter and long press

The browser clicks a native button, link, or `summary` when Enter goes down, and again on every auto-repeat, before a long press can be known. So on a host with `onLongPress` that is one of those elements, `press()` takes Enter over:

- Enter `keydown` on the host itself is cancelled, with its auto-repeats, and starts the press.
- Enter `keyup` before the long press and before Escape, blur, or a disabled host, calls `host.click()`. The browser's own activation behavior runs, so a submit button submits its form with itself as the submitter (`formaction`, `name`, and `value` included), and a link navigates.
- A long press, Escape, or blur during the hold activates nothing.

Every other host keeps the browser's own Enter: hosts without `onLongPress`, checkboxes, radios, selects, text fields and other elements Enter does not click (implicit form submission from them is untouched), Enter with Ctrl, Shift, Alt, or Meta held, and keys pressed inside the host. Space is unchanged: a native button activates on its release, and Space on a link does not activate it. A click with no key press before it, which is how assistive technology activates a control, is unaffected.

A long press cannot be performed by everyone, and assistive technology activates with a plain click. Give a long-press-only action an alternative: make the click do something useful, or offer a separate control.

The click from an Enter release is untrusted (`isTrusted` is `false`), like the early mouse click, with `detail` `0` and no pointer position as for a keyboard click. It also runs from `keyup`, which does not grant user activation, so it relies on the transient activation of the `keydown`. Chromium, Firefox, and WebKit keep it for about five seconds, so a `longPressDuration` under that is safe for clicks that open a popup, a picker, or another API that needs a user gesture.

## Behavior Notes

- The activation is a dispatched `click` (a `PointerEvent`) carrying the press's `clientX`, `clientY`, `screenX`, `screenY`, `button`, modifier keys, and `pointerType`, with `detail` `1`. The browser still runs its activation behavior for it, so checkbox and radio state, `input` and `change` events, label forwarding, form submission and reset, links, and the host's own `click` listeners behave natively and run exactly once. Same-document link navigation completes asynchronously in Firefox, as it does for a native click.
- That click is untrusted: `isTrusted` is `false`, which a page can't change. Analytics that ignore untrusted clicks won't see it. The real click that follows the release is cancelled before it reaches the host or its descendants, but listeners on ancestors, `document`, or `window` that capture still see that trailing, trusted click, so a capture listener on `window` sees the activation twice.
- Focus moves to the control on press as usual, and no text is selected. The host structurally gets `cursor: default` and `user-select: none` (with `-webkit-user-select`) in the `rmx` layer, so double- or triple-clicking a pressed label or button doesn't select its text; text-entry controls (`textarea`, `[contenteditable]`, and `input` other than checkbox, radio, button, submit, reset, image, file, color, and range), whether the host or inside it, such as the input of a wrapping label, keep their native text cursor and selection; app styles can override all of it.
- Touch and pen keep the native click so scrolling still works. Keyboard (Enter, Space) and assistive technology clicks are untouched.
- Secondary and middle buttons, presses with Ctrl, Shift, Alt, or Meta held, and presses on `:disabled` or `[aria-disabled="true"]` hosts are left to the browser.
- Early activation can't be cancelled by dragging off before release (WCAG 2.5.2 Pointer Cancellation). Use `press()` for actions that are easy to undo or that open something; leave destructive actions on the click.
- Apply it to the control itself or to a wrapping or `for=` `<label>`, not to both. A pressed `<label>` does what a native label click does, on press: checkboxes, radios and switches toggle once, text inputs, textareas and selects take focus, and a button is clicked. Safari doesn't focus a mouse-activated checkbox, radio or button, with or without `press()`. Keep other interactive content out of a pressed label.
- `press()` on a labelable control also activates it when one of its labels is pressed, wrapping or `for=`, with no markup change: a plain `<label>` around a `toggle()` input toggles on press. Presses on a link, button or other interactive content inside the label, on disabled controls, and on labels that use `press()` themselves are not handled twice. Pressing the label also keeps its text from being selected.
- Style the pressed state with `:active`.
