/**
 * Synthetic user-interaction helpers for in-browser tests. Mirrors the subset
 * of `@testing-library/user-event`'s API that DOM tests typically reach for.
 * Events are dispatched on the target element using the same ordering a real
 * browser produces:
 *
 *  - `type`  -> keydown -> beforeinput -> input -> keyup, per character, for
 *               `<input>` / `<textarea>` targets (just keydown -> keyup
 *               otherwise).
 *  - `press` -> a single keydown / keyup pair for the named key.
 *  - `click` -> a `click` MouseEvent (or `auxclick` when `button` is non-zero,
 *               matching browser dispatch rules) honoring modifier keys.
 */

/**
 * Common values for the `KeyboardEvent.key` property. The literals here give
 * editor autocomplete for the named keys most tests reach for, while
 * `string & {}` keeps the type open so single characters (`'a'`, `' '`,
 * `'Shift'`-modified glyphs, etc.) and any other valid `key` value remain
 * assignable. Full reference:
 * https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
 */
export type KeyboardKey =
  // Whitespace / actions
  | 'Enter'
  | 'Tab'
  | 'Escape'
  | 'Backspace'
  | 'Delete'
  | ' '
  // Navigation
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'
  // Modifiers (note: typically dispatched alongside another key, not by themselves)
  | 'Shift'
  | 'Control'
  | 'Alt'
  | 'Meta'
  | 'CapsLock'
  // Function keys
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'F7'
  | 'F8'
  | 'F9'
  | 'F10'
  | 'F11'
  | 'F12'
  // Anything else (single characters, lesser-used named keys, etc.)
  | (string & {})

export interface UserEvent {
  /**
   * Types `text` into `target`, dispatching `keydown` -> `beforeinput` ->
   * `input` -> `keyup` for each character. For `<input>` / `<textarea>`
   * targets the value is mutated at the current cursor (or replaces the
   * active selection) and the cursor is advanced; for any other element
   * only the keyboard events fire. Returns once the events have been
   * dispatched and one microtask has flushed, so any controlled-prop or
   * scheduler work the listeners queued has had a chance to settle before
   * the caller continues.
   *
   * The element is focused first if it isn't already. When no user-set
   * selection exists (cursor at 0/0), the cursor is moved to the end of
   * the existing value before the first character — matching what
   * `@testing-library/user-event` does so `userEvent.type(<input value="abc">, 'd')`
   * produces `'abcd'` rather than `'dabc'`.
   *
   * Each character honors `preventDefault()` on `keydown` and `beforeinput`:
   * if either is canceled, the value is not updated and `input` is not
   * dispatched (mirroring native browser behavior).
   *
   * @param target - Element to type into. `<input>` / `<textarea>` get full
   *                 keystroke + value-mutation handling; other elements get
   *                 only the keyboard events.
   * @param text   - Characters to type, one keystroke per code unit.
   *
   * @example
   * await userEvent.type(input, 'hello')
   * expect(input.value).toBe('hello')
   */
  type(target: Element, text: string): Promise<void>
  /**
   * Dispatches a single `keydown` / `keyup` pair for `key` without
   * modifying any element value. Focuses `target` first if it isn't
   * already, then yields one microtask so listener-scheduled work can
   * settle.
   *
   * Use this for keyboard shortcuts and navigation keys where the value
   * mutation that {@link UserEvent.type} performs would be wrong (Enter,
   * Escape, Tab, arrow keys, etc.).
   *
   * @param target - Element to receive the keyboard events.
   * @param key    - Value for `KeyboardEvent.key` — see {@link KeyboardKey}.
   *
   * @example
   * await userEvent.press(menu, 'ArrowDown')
   * await userEvent.press(button, 'Enter')
   */
  press(target: Element, key: KeyboardKey): Promise<void>
  /**
   * Dispatches a click event on `target`. Bubbles and is cancelable;
   * defaults to button 0 with detail 1, matching a real left-click. When
   * `options.button` is non-zero the event type is automatically promoted
   * to `auxclick` (matching how browsers route middle/right clicks).
   *
   * Pass `{ detail: 0 }` to simulate a keyboard-activated click (the
   * synthetic event browsers emit when Enter/Space is pressed on a
   * focused button), and any other `MouseEventInit` field — `metaKey`,
   * `ctrlKey`, `shiftKey`, `altKey`, `clientX`, `clientY`, etc. — to
   * customize the event further.
   *
   * @param target  - Element to click.
   * @param options - Any `MouseEventInit` overrides.
   *
   * @example
   * userEvent.click(button)
   * userEvent.click(link, { metaKey: true })       // open in new tab
   * userEvent.click(button, { detail: 0 })         // keyboard activation
   * userEvent.click(button, { button: 1 })         // middle click → auxclick
   */
  click(target: Element, options?: MouseEventInit): void
}

function isEditableField(target: Element): target is HTMLInputElement | HTMLTextAreaElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

function focusIfNeeded(target: Element) {
  if (document.activeElement === target) return
  if (target instanceof HTMLElement) target.focus()
}

// Matches `userEvent.type` semantics: when typing into a focused field that
// has no user-set selection (cursor at 0/0), default to appending at the end
// of the existing value. Without this, `userEvent.type(<input value="abc">, 'd')`
// would insert at position 0 and produce 'dabc' instead of 'abcd'.
function ensureCursorPosition(field: HTMLInputElement | HTMLTextAreaElement) {
  if (field.selectionStart === 0 && field.selectionEnd === 0 && field.value.length > 0) {
    try {
      field.setSelectionRange(field.value.length, field.value.length)
    } catch {
      // Some <input> types reject setSelectionRange.
    }
  }
}

async function type(target: Element, text: string): Promise<void> {
  focusIfNeeded(target)
  if (isEditableField(target)) ensureCursorPosition(target)

  for (let char of text) {
    let keydown = new KeyboardEvent('keydown', {
      key: char,
      bubbles: true,
      cancelable: true,
    })
    let keydownAllowed = target.dispatchEvent(keydown)

    if (keydownAllowed && isEditableField(target)) {
      let beforeInput = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: char,
      })
      let beforeInputAllowed = target.dispatchEvent(beforeInput)
      if (beforeInputAllowed) {
        let start = target.selectionStart ?? target.value.length
        let end = target.selectionEnd ?? target.value.length
        target.value = target.value.slice(0, start) + char + target.value.slice(end)
        let cursor = start + 1
        try {
          target.setSelectionRange(cursor, cursor)
        } catch {
          // Some <input> types (number, email, ...) reject setSelectionRange.
          // Skipping silently matches what the platform does.
        }
        target.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: char,
          }),
        )
      }
    }

    target.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }))
  }

  // Yield to microtasks so any controlled-prop or scheduler work queued by
  // the dispatched events can settle before the caller continues.
  await Promise.resolve()
}

async function press(target: Element, key: KeyboardKey): Promise<void> {
  focusIfNeeded(target)
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
  await Promise.resolve()
}

function click(target: Element, options: MouseEventInit = {}): void {
  // Non-primary mouse buttons fire `auxclick`, not `click`, in real browsers.
  let eventType = (options.button ?? 0) === 0 ? 'click' : 'auxclick'
  // `detail` is the click count — 1 matches a real single mouse click.
  // Browsers use `detail: 0` to signal keyboard-activated clicks (Enter/Space
  // on a focused button), which apps inspect to avoid double-firing logic.
  // Callers can pass `{ detail: 0 }` to simulate that path.
  target.dispatchEvent(
    new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      detail: 1,
      ...options,
    }),
  )
}

export const userEvent: UserEvent = { type, press, click }
