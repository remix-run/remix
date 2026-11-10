import { attrs, createMixin, css, on, ref, TypedEventTarget } from '@remix-run/component'
import type { ElementProps, Handle, RemixNode } from '@remix-run/component'

/** Content published to a toast manager. */
export interface ToastOptions<data = unknown> {
  /** Stable identity. Reusing it replaces the content and options and restarts the timer. */
  id?: string
  /** Renderable heading content. Connect its element with `title()`. */
  title?: RemixNode
  /** Renderable supporting content. Connect its element with `description()`. */
  description?: RemixNode
  /** Spoken text overriding the published title and description. */
  announcement?: string
  /** Consumer-defined data interpreted by the renderer. */
  data?: data
  /** Timeout override in milliseconds, or false to keep the notification open. Interpreted by the UI when presented. */
  timeout?: number | false
}

/** An immutable snapshot of a published notification. */
export interface ToastItem<data = unknown> {
  /** Stable identity, including generated identities. */
  readonly id: string
  /** Starts at zero and increments on each duplicate add, even with unchanged content. */
  readonly revision: number
  /** Visible heading. */
  readonly title?: RemixNode
  /** Supporting content. */
  readonly description?: RemixNode
  /** Optional spoken text overriding the published title and description. */
  readonly announcement?: string
  /** Content interpreted by the consumer's renderer. */
  readonly data?: data
  /** Optional timeout override interpreted by the notification UI. */
  readonly timeout?: number | false
}

/** Commands and observable state, without a bound component. Events signal that state can be read. */
export interface ToastManager<data = unknown> extends TypedEventTarget<{ change: Event }> {
  /** Open toast items, newest first. Updating an existing identity preserves its position. */
  readonly toastItems: readonly ToastItem<data>[]
  /** Adds or replaces a toast by identity. Omitted fields clear or use defaults. Returns its identity. */
  add(options: ToastOptions<data>): string
  /** Closes one toast, or all toasts when no identity is supplied. */
  close(id?: string): void
}

/** Connects application-level state to consumer-owned markup. */
export interface ToastContextProps<data = unknown> {
  /** Stable manager created outside the rendering component. */
  manager: ToastManager<data>
  /** Fallback timeout in milliseconds, or false to keep notifications open. A callback resolves it once per presentation or replacement without an explicit timeout. Defaults to false. */
  defaultTimeout?: number | false | ((options: ToastOptions<data>) => number | false)
  /** Maximum available toast items. Unlimited by default. Must be a positive integer. */
  limit?: number
  /** Renders every open toast item, including overflow, newest first. */
  children: (toastItems: readonly ToastItem<data>[]) => RemixNode
}

/** Region behavior. Author its element, translated label and positioning. */
export interface ToastRootOptions {
  /** Accessible name for the notification region. */
  label: string
  /** Unmodified key for entering and leaving the region. Defaults to F6. False disables it. */
  hotkey?: string | false
}

/** Scopes one notification's content and controls. */
export interface ToastItemContextProps {
  /** Toast item identity from the manager. Keep the provider keyed by the same identity. */
  value: string
  /** Consumer-owned notification markup. */
  children?: RemixNode
}

/**
 * Creates retained notification data independently of rendering.
 * @returns A manager with native EventTarget subscriptions.
 */
export function createToastManager<data = unknown>(): ToastManager<data> {
  let toastItems = new Map<string, ToastItem<data>>()
  let nextId = 0

  class ToastStore extends TypedEventTarget<{ change: Event }> implements ToastManager<data> {
    get toastItems(): readonly ToastItem<data>[] {
      return Object.freeze([...toastItems.values()].reverse())
    }
    add(options: ToastOptions<data>) {
      if (options.timeout !== undefined) validateTimeout(options.timeout)
      let id = options.id ?? `toast-${++nextId}`
      while (options.id === undefined && toastItems.has(id)) id = `toast-${++nextId}`
      let previous = toastItems.get(id)
      toastItems.set(
        id,
        Object.freeze({ ...options, id, revision: previous ? previous.revision + 1 : 0 }),
      )
      this.dispatchEvent(new Event('change'))
      return id
    }
    close(id?: string) {
      if (id === undefined) toastItems.clear()
      else if (!toastItems.delete(id)) return
      this.dispatchEvent(new Event('change'))
    }
  }
  return new ToastStore()
}

function validateTimeout(value: number | false): number | false {
  if (value !== false && (!Number.isFinite(value) || value < 0))
    throw new RangeError('Toast timeout must be false or finite and non-negative')
  return value
}

type RootState = {
  readonly limit: number
  toastManager: Pick<ToastManager<unknown>, 'close' | 'toastItems'>
  timeout(id: string): number | false
  registerRoot(node: HTMLElement, options: () => ToastRootOptions, signal: AbortSignal): void
  registerItem(id: string, node: HTMLElement, clock: ToastClock): void
  unregisterItem(id: string, node: HTMLElement): void
  focusGuard(previous: EventTarget | null): void
  readonly hasReturnTarget: boolean
  readonly focused: boolean
  readonly expanded: boolean
}

type ItemState = {
  readonly id: string
  readonly titleId: string | undefined
  readonly descriptionId: string | undefined
  registerPart(part: 'title' | 'description', node: HTMLElement, signal: AbortSignal): void
  updatePart(part: 'title' | 'description', node: HTMLElement): void
}

function ToastScope(handle: Handle<{ value: RootState; children: RemixNode }, RootState>) {
  handle.context.set(handle.props.value)
  return () => handle.props.children
}

const hidden = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
})

function isElement(target: unknown): target is HTMLElement {
  return (
    typeof target === 'object' &&
    target !== null &&
    'nodeType' in target &&
    target.nodeType === 1 &&
    'focus' in target
  )
}

function activeElement(doc: Document): HTMLElement | null {
  let active = doc.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return isElement(active) ? active : null
}

function contains(container: HTMLElement, target: Node | null): boolean {
  while (target) {
    if (container.contains(target)) return true
    let root = target.getRootNode()
    target = 'host' in root && isElement(root.host) ? root.host : null
  }
  return false
}

function focusElement(node: HTMLElement, visible = false) {
  let options: FocusOptions & { focusVisible: boolean } = {
    preventScroll: true,
    focusVisible: visible,
  }
  node.focus(options)
}

/**
 * Connects retained notifications to consumer markup, announcements and focus coordination.
 * @param handle Component lifetime and typed manager props.
 * @returns A reactive renderer for the collection and announcements.
 */
export function Context<data = unknown>(handle: Handle<ToastContextProps<data>>): () => RemixNode {
  let toastManager = handle.props.manager
  let limit = handle.props.limit ?? Infinity
  let region: HTMLElement | undefined
  let returnTo: HTMLElement | undefined
  let entering = false
  let presentations = new Map<string, { node: HTMLElement; clock: ToastClock }>()
  let previous = toastManager.toastItems.map((toastItem) => toastItem.id)
  let interaction = createInteractionState((paused) => {
    for (let { clock } of presentations.values()) clock.setPaused(paused)
    if (!handle.signal.aborted) void handle.update()
  })

  function restoreFocus(): boolean {
    if (!region || !returnTo) return false
    let doc = region.ownerDocument
    if (returnTo === doc.body) activeElement(doc)?.blur()
    else if (returnTo.isConnected) focusElement(returnTo)
    let restored = !contains(region, activeElement(doc))
    if (restored) returnTo = undefined
    return restored
  }

  function refresh() {
    let toastItems = toastManager.toastItems
    let available = new Set(toastItems.slice(0, limit).map((toastItem) => toastItem.id))
    let active = region && activeElement(region.ownerDocument)
    if (region && !available.size && active && contains(region, active)) {
      if (!restoreFocus()) active.blur()
      active = activeElement(region.ownerDocument)
    }
    for (let [id, { node }] of presentations) {
      if (!available.has(id) && active && contains(node, active)) {
        if (!interaction.keyboardFocused && !active.matches(':focus-visible')) {
          active.blur()
          continue
        }
        let index = previous.indexOf(id)
        let candidates = [...previous.slice(index + 1), ...previous.slice(0, index).reverse()]
        let target = candidates
          .filter((candidate) => available.has(candidate))
          .map((candidate) => presentations.get(candidate)?.node)
          .find((candidate) => candidate?.isConnected && !candidate.inert)
        if (target) focusElement(target, true)
        else if (!restoreFocus()) active.blur()
      }
    }
    // Focusing a neighbour may run consumer handlers that close more notifications.
    toastItems = toastManager.toastItems
    available = new Set(toastItems.slice(0, limit).map((toastItem) => toastItem.id))
    previous = toastItems.map((toastItem) => toastItem.id)
    for (let [id, { node }] of presentations) {
      let unavailable = !available.has(id)
      node.inert = unavailable
      if (unavailable || !state.focused) node.setAttribute('aria-hidden', 'true')
      else node.removeAttribute('aria-hidden')
    }
  }

  let state: RootState = {
    toastManager,
    timeout(id) {
      let toastItem = toastManager.toastItems.find((toastItem) => toastItem.id === id)
      if (!toastItem) return false
      let defaultTimeout = handle.props.defaultTimeout ?? false
      return validateTimeout(
        toastItem.timeout ??
          (typeof defaultTimeout === 'function' ? defaultTimeout(toastItem) : defaultTimeout),
      )
    },
    get limit() {
      return limit
    },
    focusGuard(previous) {
      let target =
        previous === region
          ? toastManager.toastItems
              .slice(0, limit)
              .map((toastItem) => presentations.get(toastItem.id)?.node)
              .find((node) => node?.isConnected && !node.inert)
          : undefined
      if (target) focusElement(target, true)
      else restoreFocus()
    },
    get hasReturnTarget() {
      return returnTo !== undefined
    },
    get focused() {
      return Boolean(region && contains(region, activeElement(region.ownerDocument)))
    },
    get expanded() {
      return interaction.expanded
    },
    registerItem(id, node, clock) {
      presentations.set(id, { node, clock })
      clock.setPaused(interaction.paused)
      refresh()
      if (!handle.signal.aborted) void handle.update()
    },
    unregisterItem(id, node) {
      if (presentations.get(id)?.node !== node) return
      presentations.delete(id)
      if (!toastManager.toastItems.length) {
        interaction.clearPointerInteraction()
      }
      refresh()
      if (!handle.signal.aborted) void handle.update()
    },
    registerRoot(node, options, signal) {
      if (region && region !== node) throw new Error('Mount only one toast.root() per Context')
      region = node
      let doc = node.ownerDocument
      let win = doc.defaultView
      node.addEventListener(
        'pointerdown',
        (event) => {
          if (event.pointerType !== 'touch' || !event.isPrimary || event.button !== 0) return
          interaction.set('touchEngaged', true)
        },
        { signal },
      )
      doc.addEventListener(
        'pointerdown',
        (event) => {
          if (
            !interaction.touchEngaged ||
            event.pointerType !== 'touch' ||
            !event.isPrimary ||
            event.button !== 0 ||
            event.composedPath().includes(node)
          )
            return
          interaction.clearPointerInteraction()
          let active = activeElement(doc)
          if (active && contains(node, active)) active.blur()
        },
        { capture: true, signal },
      )
      node.addEventListener(
        'pointerenter',
        (event) => {
          if (event.pointerType === 'touch') return
          interaction.set('hovered', true)
        },
        { signal },
      )
      node.addEventListener(
        'pointerleave',
        () => {
          interaction.set('hovered', false)
        },
        { signal },
      )
      node.addEventListener(
        'focusin',
        (event) => {
          let active = activeElement(doc)
          if (active && (entering || active.matches(':focus-visible'))) {
            if (!entering && isElement(event.relatedTarget) && !contains(node, event.relatedTarget))
              returnTo = event.relatedTarget
            interaction.set('keyboardFocused', true)
          }
          refresh()
          void handle.update()
        },
        { signal },
      )
      node.addEventListener(
        'focusout',
        (event) => {
          if (isElement(event.relatedTarget) && contains(node, event.relatedTarget)) return
          interaction.set('keyboardFocused', false)
          refresh()
          void handle.update()
        },
        { signal },
      )
      node.addEventListener(
        'keydown',
        (event) => {
          if (event.defaultPrevented) return
          if (event.key === (options().hotkey ?? 'F6')) {
            event.stopPropagation()
            if (restoreFocus()) event.preventDefault()
            return
          }
          if (
            event.key === 'Tab' &&
            event.shiftKey &&
            activeElement(doc) === node &&
            restoreFocus()
          ) {
            event.preventDefault()
          }
        },
        { signal },
      )
      doc.addEventListener(
        'keydown',
        (event) => {
          if (
            event.key !== (options().hotkey ?? 'F6') ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.defaultPrevented ||
            !node.getClientRects().length ||
            node.closest('[inert]')
          )
            return
          if (!toastManager.toastItems.length || contains(node, activeElement(doc))) return
          returnTo = activeElement(doc) ?? doc.body
          entering = true
          try {
            focusElement(node, true)
          } finally {
            entering = false
          }
          if (activeElement(doc) === node) event.preventDefault()
        },
        { signal },
      )
      function onVisibility() {
        interaction.set('documentHidden', doc.hidden)
      }
      doc.addEventListener('visibilitychange', onVisibility, { signal })
      win?.addEventListener(
        'blur',
        (event) => {
          if (event.target === win) interaction.set('windowBlurred', true)
        },
        { signal },
      )
      win?.addEventListener(
        'focus',
        (event) => {
          if (event.target === win) interaction.set('windowBlurred', false)
        },
        { signal },
      )
      onVisibility()
      signal.addEventListener(
        'abort',
        () => {
          region = undefined
          returnTo = undefined
          interaction.reset()
        },
        { once: true },
      )
      refresh()
    },
  }

  function sync() {
    refresh()
    void handle.update()
  }
  handle.queueTask(() => {
    toastManager.addEventListener('change', sync, { signal: handle.signal })
    sync()
  })
  return () => {
    let defaultTimeout = handle.props.defaultTimeout
    if (defaultTimeout !== undefined && typeof defaultTimeout !== 'function')
      validateTimeout(defaultTimeout)
    let nextLimit = handle.props.limit ?? Infinity
    if (handle.props.limit !== undefined && (!Number.isInteger(nextLimit) || nextLimit < 1))
      throw new RangeError('Toast limit must be a positive integer')
    if (limit !== nextLimit) {
      limit = nextLimit
      refresh()
    }
    return (
      <ToastScope value={state}>
        {handle.props.children(toastManager.toastItems)}
        <div aria-live="polite" aria-atomic="false" aria-relevant="additions text" mix={hidden}>
          {!state.focused &&
            toastManager.toastItems
              .filter((toastItem) => presentations.has(toastItem.id))
              .map((toastItem) => (
                <div key={JSON.stringify([toastItem.id, toastItem.revision])} aria-atomic="true">
                  {toastItem.announcement !== undefined ? (
                    toastItem.announcement
                  ) : (
                    <>
                      <div>{toastItem.title}</div>
                      <div>{toastItem.description}</div>
                    </>
                  )}
                </div>
              ))}
        </div>
      </ToastScope>
    )
  }
}

/** A named notification region with keyboard entry. */
export const root = createMixin<HTMLElement, [options: ToastRootOptions], ElementProps>(
  (handle) => {
    let context = handle.context.get(ToastScope)
    if (!context) throw new Error('toast.root() must be rendered inside toast.Context')
    let options: ToastRootOptions
    return (nextOptions) => {
      if (typeof nextOptions?.label !== 'string' || !nextOptions.label.trim())
        throw new Error('toast.root() requires a non-empty label')
      options = nextOptions
      return [
        attrs({
          role: 'region',
          'aria-label': options.label,
          tabIndex: -1,
          'data-expanded': context.expanded ? '' : undefined,
        }),
        ref((node: HTMLElement, signal) => context.registerRoot(node, () => options, signal)),
      ]
    }
  },
)

function FocusGuard(handle: Handle<{ active: boolean }>) {
  let context = handle.context.get(ToastScope)
  let voiceOverWebKit = false
  return () => {
    let role: 'button' | undefined = handle.props.active && voiceOverWebKit ? 'button' : undefined
    return (
      <span
        tabIndex={handle.props.active ? 0 : -1}
        role={role}
        aria-hidden={role ? undefined : 'true'}
        data-toast-focus-guard=""
        mix={[
          hidden,
          ref((node: HTMLElement) => {
            let win = node.ownerDocument.defaultView
            let platform = win?.navigator.platform.toLowerCase() ?? ''
            // WebKit needs role-button guards for VoiceOver's virtual cursor to dispatch focus.
            let next =
              (platform.startsWith('mac') || /^i(os$|p)/.test(platform)) &&
              Boolean(win?.CSS.supports?.('-webkit-backdrop-filter:none'))
            if (voiceOverWebKit === next) return
            voiceOverWebKit = next
            void handle.update()
          }),
          on('focus', (event) => context.focusGuard(event.relatedTarget)),
        ]}
      />
    )
  }
}

/**
 * Scopes a notification's content and controls and coordinates keyboard boundary guards.
 * @param handle Notification identity and consumer-owned markup.
 * @returns The notification's markup with shared item context.
 */
export function ItemContext(handle: Handle<ToastItemContextProps, ItemState>): () => RemixNode {
  let context = handle.context.get(ToastScope)
  if (!context) throw new Error('toast.ItemContext must be rendered inside toast.Context')
  let parts = new Map<'title' | 'description', { node: HTMLElement; id: string }>()
  function updatePart(part: 'title' | 'description', node: HTMLElement) {
    let previous = parts.get(part)
    let present = node.textContent !== '' || node.querySelector('[aria-label],img[alt]') !== null
    if (present && (previous?.node !== node || previous.id !== node.id)) {
      parts.set(part, { node, id: node.id })
      void handle.update()
    } else if (!present && previous?.node === node) {
      parts.delete(part)
      void handle.update()
    }
  }
  handle.context.set({
    get id() {
      return handle.props.value
    },
    get titleId() {
      return parts.get('title')?.id
    },
    get descriptionId() {
      return parts.get('description')?.id
    },
    updatePart,
    registerPart(part, node, signal) {
      let sync = () => {
        if (!signal.aborted) updatePart(part, node)
      }
      sync()
      let Observer = node.ownerDocument.defaultView?.MutationObserver
      let observer = Observer && new Observer(sync)
      observer?.observe(node, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['id', 'aria-label', 'alt'],
      })
      signal.addEventListener(
        'abort',
        () => {
          observer?.disconnect()
          if (parts.get(part)?.node === node) {
            parts.delete(part)
            if (!handle.signal.aborted) void handle.update()
          }
        },
        { once: true },
      )
    },
  })
  return () => {
    let available = context.toastManager.toastItems.slice(0, context.limit)
    let first = available[0]?.id === handle.props.value
    let last = available.at(-1)?.id === handle.props.value
    return (
      <>
        <FocusGuard active={context.hasReturnTarget && first} />
        {handle.props.children}
        <FocusGuard active={context.hasReturnTarget && last} />
      </>
    )
  }
}

/** Optional presentation behavior for a toast item. */
export interface ToastItemOptions {
  /** Animates the inherited `--toast-countdown` fraction from 1 to 0. Defaults to false. */
  countdown?: boolean
}

/**
 * Gives the scoped toast dialog semantics, presentation lifetime and focus recovery.
 * Without a title, supply an accessible name on the host with aria-label or aria-labelledby.
 */
export const item = createMixin<HTMLElement, [options?: ToastItemOptions], ElementProps>(
  (handle) => {
    let context = handle.context.get(ToastScope)
    let scoped = handle.context.get(ItemContext)
    if (!context || !scoped)
      throw new Error('toast.item() must be rendered inside toast.ItemContext')
    let host: HTMLElement | undefined
    let publication: ToastItem<unknown> | undefined
    let countdown = false
    let animation: Animation | undefined
    let clock = createToastClock(() => {
      let current = context.toastManager.toastItems.find((toastItem) => toastItem.id === scoped.id)
      if (current && current === publication) context.toastManager.close(scoped.id)
    }, synchronizeCountdown)

    function synchronizeCountdown() {
      animation?.cancel()
      animation = undefined
      if (!host || !countdown || clock.duration === false) return
      registerCountdownProperty()
      animation = host.animate([{ '--toast-countdown': '1' }, { '--toast-countdown': '0' }], {
        duration: clock.duration,
        fill: 'both',
        easing: 'linear',
      })
      animation.currentTime = clock.duration - clock.remaining
      if (clock.paused) animation.pause()
    }

    function synchronizeClock(toastItem: ToastItem<unknown> | undefined) {
      if (!host || publication === toastItem) return
      let duration = toastItem ? context.timeout(scoped.id) : false
      publication = toastItem
      clock.reset(duration)
    }

    function connect(node: HTMLElement) {
      host = node
      publication = undefined
      context.registerItem(scoped.id, node, clock)
      synchronizeClock(
        context.toastManager.toastItems.find((toastItem) => toastItem.id === scoped.id),
      )
    }
    handle.addEventListener('insert', (event) => connect(event.node))
    handle.addEventListener('reclaimed', (event) => connect(event.node))
    handle.addEventListener('beforeRemove', () => clock.dispose())
    function disconnect() {
      clock.dispose()
      if (host) context.unregisterItem(scoped.id, host)
      host = undefined
      publication = undefined
    }
    handle.addEventListener('remove', disconnect)
    handle.signal.addEventListener('abort', disconnect, { once: true })
    return (options = {}) => {
      let toastItems = context.toastManager.toastItems
      let index = toastItems.findIndex((toastItem) => toastItem.id === scoped.id)
      let toastItem = toastItems[index]
      if (countdown !== Boolean(options.countdown)) {
        countdown = Boolean(options.countdown)
        synchronizeCountdown()
      }
      synchronizeClock(toastItem)
      let limited = index >= context.limit
      return [
        attrs({
          inert: limited || !toastItem ? true : undefined,
          'aria-hidden': limited || !toastItem || !context.focused ? 'true' : undefined,
          'data-limited': limited ? '' : undefined,
          role: 'dialog',
          'aria-modal': 'false',
          'aria-labelledby': scoped.titleId,
          'aria-describedby': scoped.descriptionId,
          tabIndex: 0,
          'data-toast': '',
        }),
        on('keydown', (event) => {
          if (
            event.defaultPrevented ||
            event.key !== 'Escape' ||
            !host ||
            !contains(host, activeElement(host.ownerDocument))
          )
            return
          context.toastManager.close(scoped.id)
        }),
      ]
    }
  },
)

function labelPart(part: 'title' | 'description') {
  return createMixin<HTMLElement, [], ElementProps>((handle) => {
    let scoped = handle.context.get(ItemContext)
    if (!scoped) throw new Error(`toast.${part}() must be rendered inside toast.ItemContext`)
    handle.addEventListener('commit', () => {
      handle.queueTask((node) => scoped.updatePart(part, node))
    })
    return (props) => [
      attrs({ id: props.id ?? `${handle.id}-${part}` }),
      ref((node: HTMLElement, signal) => scoped.registerPart(part, node, signal)),
    ]
  })
}

/** Connects the consumer-owned heading to the toast's accessible name. */
export const title = labelPart('title')
/** Connects the consumer-owned supporting content to the toast's accessible description. */
export const description = labelPart('description')

/** Closes the scoped toast. Supply a native button and its translated text or accessible label. */
export const close = createMixin<HTMLButtonElement, [], ElementProps>((handle) => {
  let scoped = handle.context.get(ItemContext)
  let context = handle.context.get(ToastScope)
  if (!scoped || !context)
    throw new Error('toast.close() must be rendered inside toast.ItemContext')
  return (props) => [
    attrs({
      type: props.type ?? 'button',
    }),
    on('click', (event) => {
      if (!event.defaultPrevented) context.toastManager.close(scoped.id)
    }),
  ]
})

let countdownPropertyRegistered = false

function registerCountdownProperty() {
  if (countdownPropertyRegistered) return
  CSS.registerProperty({
    name: '--toast-countdown',
    syntax: '<number>',
    inherits: true,
    initialValue: '1',
  })
  countdownPropertyRegistered = true
}

type ClockState =
  | { status: 'inactive'; paused: boolean }
  | { status: 'paused'; duration: number; remaining: number }
  | {
      status: 'running'
      duration: number
      remaining: number
      started: number
      timer: ReturnType<typeof setTimeout>
    }

type ToastClock = ReturnType<typeof createToastClock>

function createToastClock(expire: () => void, changed: () => void) {
  let state: ClockState = { status: 'inactive', paused: false }

  function paused() {
    return state.status === 'inactive' ? state.paused : state.status === 'paused'
  }

  function remaining() {
    if (state.status === 'inactive') return 0
    return Math.max(
      0,
      state.remaining - (state.status === 'running' ? performance.now() - state.started : 0),
    )
  }

  function cancel() {
    if (state.status === 'running') clearTimeout(state.timer)
  }

  function start(duration: number, remaining: number) {
    state = {
      status: 'running',
      duration,
      remaining,
      started: performance.now(),
      timer: setTimeout(() => {
        state = { status: 'inactive', paused: false }
        expire()
      }, remaining),
    }
  }

  return {
    get duration(): number | false {
      return state.status === 'inactive' ? false : state.duration
    },
    get remaining() {
      return remaining()
    },
    get paused() {
      return paused()
    },
    reset(duration: number | false) {
      let isPaused = paused()
      cancel()
      if (duration === false) state = { status: 'inactive', paused: isPaused }
      else if (isPaused) state = { status: 'paused', duration, remaining: duration }
      else start(duration, duration)
      changed()
    },
    setPaused(next: boolean) {
      if (paused() === next) return
      if (state.status === 'inactive') state = { status: 'inactive', paused: next }
      else if (state.status === 'running') {
        let timeLeft = remaining()
        cancel()
        state = { status: 'paused', duration: state.duration, remaining: timeLeft }
      } else start(state.duration, state.remaining)
      changed()
    },
    dispose() {
      let isPaused = paused()
      cancel()
      state = { status: 'inactive', paused: isPaused }
      changed()
    },
  }
}

interface InteractionState {
  hovered: boolean
  keyboardFocused: boolean
  touchEngaged: boolean
  documentHidden: boolean
  windowBlurred: boolean
}

const initialInteractionState: InteractionState = {
  hovered: false,
  keyboardFocused: false,
  touchEngaged: false,
  documentHidden: false,
  windowBlurred: false,
}

function createInteractionState(changed: (paused: boolean) => void) {
  let state = initialInteractionState

  function update(next: InteractionState) {
    if (
      next.hovered === state.hovered &&
      next.keyboardFocused === state.keyboardFocused &&
      next.touchEngaged === state.touchEngaged &&
      next.documentHidden === state.documentHidden &&
      next.windowBlurred === state.windowBlurred
    )
      return
    state = next
    changed(expanded() || state.documentHidden || state.windowBlurred)
  }

  function expanded() {
    return state.hovered || state.keyboardFocused || state.touchEngaged
  }

  return {
    get keyboardFocused() {
      return state.keyboardFocused
    },
    get touchEngaged() {
      return state.touchEngaged
    },
    get expanded() {
      return expanded()
    },
    get paused() {
      return expanded() || state.documentHidden || state.windowBlurred
    },
    set(fact: keyof InteractionState, value: boolean) {
      update({ ...state, [fact]: value })
    },
    clearPointerInteraction() {
      update({ ...state, touchEngaged: false, hovered: false })
    },
    reset() {
      update(initialInteractionState)
    },
  }
}
