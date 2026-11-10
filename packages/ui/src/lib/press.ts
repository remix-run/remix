import { createMixin, css, on } from '@remix-run/component'

const LONG_PRESS_DURATION = 500

export const DISABLED = ':disabled, [aria-disabled="true"]'

const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [contenteditable]'

const TEXT_ENTRY =
  'textarea, [contenteditable]:not([contenteditable="false"]), input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="image"], [type="file"], [type="color"], [type="range"])'

/**
 * Where a press happened. Keyboard presses report the center of the host.
 */
export type PressInfo = {
  clientX: number
  clientY: number
  /** `'mouse'`, `'pen'`, `'touch'`, or `'keyboard'`. */
  pointerType: string
}

/**
 * Press lifecycle callbacks for `press()`.
 */
export type PressOptions = {
  /**
   * Called when a primary-button pointer press or an Enter or Space key press starts on the host,
   * for every pointer type, before any activation.
   */
  onPressStart?(press: PressInfo): void
  /**
   * Called once for every `onPressStart`. `cancelled` is `false` when the press was released over
   * the host, and `true` when the pointer left the host or was interrupted by `pointercancel`
   * (such as a scroll), the host lost focus, Escape was pressed, or a long press consumed it.
   */
  onPressEnd?(press: PressInfo & { cancelled: boolean }): void
  /**
   * Called when a press has been held for `longPressDuration`. A long press consumes the press:
   * releasing it ends with `cancelled: true` and nothing is activated. A host with `onLongPress`
   * activates on release, even for the mouse and for Enter on a native button or link, since an
   * early activation could not be taken back.
   */
  onLongPress?(press: PressInfo): void
  /** How long a press is held before `onLongPress`, in milliseconds. Defaults to `500`. */
  longPressDuration?: number
  /**
   * Whether a primary-button mouse press activates the host on press instead of on release.
   * Defaults to `true`. `false` keeps the native click and only reports the lifecycle.
   */
  activate?: boolean
}

type PressState = { trailingClick?: AbortController; tracking?: boolean }

// A primary-button press without modifier keys, which is what both activation and the lifecycle
// respond to. Modifier presses belong to the browser (a Ctrl-click is a context menu on macOS).
export function isPlainPress(event: PointerEvent) {
  return (
    event.isPrimary !== false &&
    event.button === 0 &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.metaKey
  )
}

// Cancels the next click on `host`, capturing so that listeners on it and inside it never see it.
function blockClick(host: HTMLElement, signal: AbortSignal) {
  host.addEventListener(
    'click',
    (click) => {
      click.preventDefault()
      click.stopImmediatePropagation()
    },
    { capture: true, once: true, signal },
  )
}

// Whether Enter on `host` is a press that activates on release instead of the browser's own click
// at keydown (and again at every auto-repeat). Only a host with `onLongPress` defers it, since
// only a long press can't be taken back; only elements that the browser clicks on Enter have
// anything to defer (not checkboxes, radios or text fields, whose Enter submits the form
// implicitly); and Enter with a modifier key (Ctrl-Enter on a link) belongs to the browser.
function defersEnter(event: KeyboardEvent, host: HTMLElement, options: PressOptions) {
  return (
    event.key === 'Enter' &&
    event.target === host &&
    !!options.onLongPress &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.metaKey &&
    host.matches(
      'button, summary, a[href], input:is([type="button"], [type="submit"], [type="reset"], [type="image"], [type="color"], [type="file"])',
    ) &&
    !host.matches(DISABLED)
  )
}

// Reports the lifecycle of a press on `host` from `event`, the `pointerdown` or `keydown` that
// started it, to the callbacks in `options`. It observes activation rather than choosing it, which
// is `startPress` for the mouse and the browser's own click otherwise, so callbacks fire for touch,
// pen and keyboard presses and with `activate: false`. The one activation it takes over is Enter
// on a native host with `onLongPress` (see `defersEnter`), which it clicks on release.
function trackPress(
  event: PointerEvent | KeyboardEvent,
  host: HTMLElement,
  options: PressOptions,
  state: PressState,
  lifetime: AbortSignal,
) {
  let { onPressStart, onPressEnd, onLongPress, longPressDuration = LONG_PRESS_DURATION } = options
  let deferred = 'key' in event && defersEnter(event, host, options)
  // Auto-repeat would click the host again and again, and a press that ended early (Escape) must
  // still not activate natively while the key is held.
  if ('key' in event && deferred && event.repeat) event.preventDefault()
  if (state.tracking || (!onPressStart && !onPressEnd && !onLongPress)) return
  if (host.matches(DISABLED)) return

  if ('key' in event) {
    if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat || event.target !== host) {
      return
    }
    if (deferred) event.preventDefault()
    // Space scrolls the page unless the host activates on it natively.
    if (event.key === ' ' && !host.matches('button, input, select, summary')) {
      event.preventDefault()
    }
  } else {
    if (!isPlainPress(event)) return
    // Touch and pen get implicit pointer capture, which retargets every later event to the host.
    // Dropping it lets "released outside the host" mean the same thing for every pointer type.
    let target = event.target
    if (target instanceof Element && target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId)
    }
  }

  let rect = host.getBoundingClientRect()
  let press: PressInfo =
    'key' in event
      ? {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          pointerType: 'keyboard',
        }
      : { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType }

  let doc = host.ownerDocument
  let session = new AbortController()
  let signal = AbortSignal.any([lifetime, session.signal])
  let ended = false
  let consumed = false
  let timer = 0

  // A press ends once, but its release can still follow: the click that trails a consumed or
  // cancelled press is cancelled when it does.
  function finish(cancelled: boolean, at: { clientX: number; clientY: number } = press) {
    if (ended) return
    ended = true
    clearTimeout(timer)
    onPressEnd?.({ ...press, ...at, cancelled })
  }

  function release(inside: boolean, at?: { clientX: number; clientY: number }) {
    session.abort()
    state.tracking = false
    if (consumed) {
      let guard = new AbortController()
      blockClick(host, AbortSignal.any([lifetime, guard.signal]))
      // A click, when there is one, is dispatched in the same task as the release.
      setTimeout(() => guard.abort())
    }
    let activates = deferred && !consumed && inside
    finish(consumed || !inside, at && { clientX: at.clientX, clientY: at.clientY })
    // A click from keyup is untrusted, but the browser still runs the host's activation behavior
    // (submit, navigate) with the keyboard click's shape: `detail` 0 and no pointer position. It
    // relies on the transient user activation of the keydown, which browsers keep for about 5
    // seconds, so a `longPressDuration` beyond that can lose it on a release just before the
    // long press.
    if (activates && !host.matches(DISABLED)) host.click()
  }

  function cancel() {
    consumed = true
    finish(true)
  }

  state.tracking = true
  signal.addEventListener('abort', () => clearTimeout(timer))
  onPressStart?.(press)

  if (onLongPress) {
    timer = window.setTimeout(() => {
      consumed = true
      onLongPress(press)
    }, longPressDuration)
  }

  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') cancel()
    },
    { capture: true, signal },
  )

  if ('key' in event) {
    let key = event.key
    doc.addEventListener(
      'keyup',
      (up) => {
        if (up.key === key) release(true)
      },
      { capture: true, signal },
    )
    host.addEventListener(
      'blur',
      () => {
        release(false)
      },
      { signal },
    )
  } else {
    host.addEventListener('pointerleave', cancel, { signal })
    doc.addEventListener(
      'pointerup',
      (up) => release(up.target instanceof Node && host.contains(up.target), up),
      { capture: true, signal },
    )
    doc.addEventListener('pointercancel', () => release(false), { capture: true, signal })
  }
}

// Dispatches a click on `host` the way the browser would for the release of `event`, with the
// pointer's position and button, so listeners see a real-looking click and the browser still runs
// its activation behavior (checkbox and radio state, label forwarding, submit and reset, links).
// It remains an untrusted event (`isTrusted` is `false`), which the browser doesn't allow to change.
function click(host: HTMLElement, event: PointerEvent) {
  host.dispatchEvent(
    new PointerEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: host.ownerDocument.defaultView,
      detail: 1,
      button: 0,
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: true,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    }),
  )
}

// Presses on `host`, which is the element that receives the press: the pressed control, or a label
// whose control is pressed.
function startPress(
  event: PointerEvent,
  host: HTMLElement,
  state: PressState,
  lifetime: AbortSignal,
) {
  if (event.pointerType !== 'mouse' || !isPlainPress(event) || host.matches(DISABLED)) {
    return
  }

  // A press that never released must not swallow this press's own click.
  state.trailingClick?.abort()
  // A label activates its control the way a native label click does, so the browser's own
  // forwarding and focus rules apply (Safari doesn't focus a mouse-activated checkbox, radio
  // or button). That focus must outlive the press: the default focus change of the press
  // would take it back. Firefox drops the click a label forwards when its own control was the
  // pressed element, so that press clicks the control directly and keeps its native focus.
  let control = host instanceof HTMLLabelElement ? host.control : null
  let pressedControl =
    control && event.target instanceof Node && control.contains(event.target) ? control : null
  if (host instanceof HTMLLabelElement && !pressedControl) {
    event.preventDefault()
  }
  click(pressedControl ?? host, event)

  let doc = host.ownerDocument
  let release = new AbortController()
  let guard = (state.trailingClick = new AbortController())

  blockClick(host, AbortSignal.any([lifetime, guard.signal]))

  function end() {
    release.abort()
    // A click, when there is one, is dispatched in the same task as the pointerup.
    setTimeout(() => guard.abort())
  }

  let signal = AbortSignal.any([lifetime, release.signal])
  doc.addEventListener('pointerup', end, { capture: true, signal })
  doc.addEventListener('pointercancel', end, { capture: true, signal })
}

// A press on a label of a press host activates that host, so a plain `<label>` that wraps or
// points at a pressed control behaves like the control. One capture listener per document handles
// every such label, and exists only while the document has press hosts.
const documentPresses = new Map<
  Document,
  { hosts: Map<Element, () => boolean>; release: AbortController }
>()
const labelPress: PressState = {}

function trackHost(host: Element, activates: () => boolean, lifetime: AbortSignal) {
  let doc = host.ownerDocument
  let entry = documentPresses.get(doc)

  if (!entry) {
    let current = { hosts: new Map<Element, () => boolean>(), release: new AbortController() }
    entry = current
    documentPresses.set(doc, current)
    current.release.signal.addEventListener('abort', () => documentPresses.delete(doc))

    doc.addEventListener(
      'pointerdown',
      (event) => {
        let target = event.target instanceof Element ? event.target : null
        let label = target?.closest('label')
        let control = label?.control
        let activates = control && current.hosts.get(control)
        if (!target || !label || !control || !activates || current.hosts.has(label)) {
          return
        }

        // The control handles its own press, and other interactive content in the label is not
        // the label's to activate.
        let interactive = target.closest(INTERACTIVE)
        if ((interactive && label.contains(interactive)) || control.matches(DISABLED)) {
          return
        }

        if (activates()) startPress(event, label, labelPress, current.release.signal)
      },
      { capture: true, signal: current.release.signal },
    )
  }

  let { hosts, release } = entry
  hosts.set(host, activates)
  lifetime.addEventListener('abort', () => {
    hosts.delete(host)
    if (hosts.size === 0) release.abort()
  })
}

/**
 * The style of something that is activated rather than read: a default cursor and no text
 * selection. Text-entry controls, the host itself or any inside it (such as the input of a
 * wrapping label), keep their native cursor and selection.
 *
 * @returns The `css()` mixin
 */
export function pressableCss() {
  return css({
    cursor: 'default',
    userSelect: 'none',
    webkitUserSelect: 'none',
    [`&:is(${TEXT_ENTRY}), & :is(${TEXT_ENTRY})`]: {
      cursor: 'auto',
      userSelect: 'text',
      webkitUserSelect: 'text',
    },
  })
}

// Activates the host on primary-button mouse `pointerdown` by dispatching a click on it, so
// checkbox and radio state, `input` and `change` events, label forwarding, form submission and
// the host's own `click` listeners all behave as they do for a release. The real `click` that
// trails the press is cancelled so the host never activates twice.
//
// Touch and pen keep the native click so scrolling and tap cancellation still work, and keyboard
// and assistive technology clicks are untouched. Presses with a modifier key, on secondary
// buttons, and on disabled hosts are left to the browser. `activate: false` and `onLongPress`
// (an early activation can't be taken back) leave activation to the native click too.
//
// The optional lifecycle callbacks (see `trackPress`) report the press without changing it.
export const press = createMixin<HTMLElement, [options?: PressOptions]>((handle) => {
  let lifetime = handle.signal
  let state: PressState = {}
  let latest: PressOptions = {}

  function activates() {
    return latest.activate !== false && !latest.onLongPress
  }

  handle.queueTask((node) => trackHost(node, activates, lifetime))

  return (options = {}) => {
    latest = options

    return [
      pressableCss(),
      on('pointerdown', (event) => {
        trackPress(event, event.currentTarget, latest, state, lifetime)
        if (activates()) startPress(event, event.currentTarget, state, lifetime)
      }),
      on('keydown', (event) => trackPress(event, event.currentTarget, latest, state, lifetime)),
    ]
  }
})
