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
  /** Consumer-defined data interpreted by the renderer. */
  data?: data
  /** Auto-dismiss timeout in milliseconds, or false to disable. Zero dismisses immediately. Falls back to the manager default, or false. */
  timeout?: number | false
  /** Announcement urgency. Defaults to low (polite); high uses an assertive alert. */
  priority?: 'low' | 'high'
}

/** Default policy for notifications published through a manager. */
export interface ToastManagerOptions<data = unknown> {
  /** Fallback timeout in milliseconds, or false to disable. A callback resolves it once per add without an explicit timeout. Defaults to false. */
  defaultTimeout?: number | false | ((options: ToastOptions<data>) => number | false)
}

/** An immutable toast item snapshot. Read the manager again for the current remaining time. */
export interface ToastItem<data = unknown> {
  /** Stable identity, including generated identities. */
  readonly id: string
  /** Starts at zero and increments on each duplicate add, even with unchanged content. */
  readonly revision: number
  /** Visible heading. */
  readonly title?: RemixNode
  /** Supporting content. */
  readonly description?: RemixNode
  /** Content interpreted by the consumer's renderer. */
  readonly data?: data
  /** Configured timeout in milliseconds, or false for a persistent toast. */
  readonly timeout: number | false
  /** Remaining time in milliseconds, or zero when persistent. Sampled when this snapshot was read. */
  readonly remaining: number
  /** Whether the timer is stopped, including while no item presents the toast. */
  readonly paused: boolean
  /** Whether at least one mounted item presents this toast. */
  readonly presented: boolean
  /** Announcement urgency, independent of data and timeout. */
  readonly priority: 'low' | 'high'
}

/** Commands and observable state, without a bound component. Events signal that state can be read. */
export interface ToastManager<data = unknown> extends TypedEventTarget<{ change: Event }> {
  /** Open toast items, newest first. Updating an existing identity preserves its position. */
  readonly toastItems: readonly ToastItem<data>[]
  /** Adds or replaces a toast by identity. Omitted fields clear or use defaults. Returns its identity. */
  add(options: ToastOptions<data>): string
  /** Closes one toast, or all toasts when no identity is supplied. */
  close(id?: string): void
  /** Pauses all timers for an opaque reason. New arrivals inherit active reasons. */
  pause(reason: unknown): void
  /** Removes just this pause reason. Other reasons continue to pause timers. */
  resume(reason: unknown): void
  /** Presents an item for the signal's lifetime. Multiple presentations share one timer. */
  present(id: string, signal: AbortSignal): void
}

/** Connects application-level state to consumer-owned markup. */
export interface ToastContextProps<data = unknown> {
  /** Stable manager created outside the rendering component. */
  manager: ToastManager<data>
  /** Maximum available toast items. Defaults to 3. Must be a positive integer. */
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

type StoredToastItem<data> = {
  revision: number
  options: ToastOptions<data>
  timeout: number | false
  remaining: number
  started: number | null
  timer?: ReturnType<typeof setTimeout>
  presentations: Set<symbol>
}

/**
 * Creates retained toast state independently of rendering. Timers run only while presented.
 * @param options Default notification policy.
 * @returns A manager with native EventTarget subscriptions.
 */
export function createToastManager<data = unknown>(
  options: ToastManagerOptions<data> = {},
): ToastManager<data> {
  let defaultTimeout = options.defaultTimeout ?? false
  if (typeof defaultTimeout !== 'function') validateTimeout(defaultTimeout)
  let storedToastItems = new Map<string, StoredToastItem<data>>()
  let reasons = new Set<unknown>()
  let nextId = 0

  function changed() {
    toastManager.dispatchEvent(new Event('change'))
  }

  function remaining(toastItem: StoredToastItem<data>) {
    return Math.max(
      0,
      toastItem.remaining -
        (toastItem.started === null ? 0 : performance.now() - toastItem.started),
    )
  }

  function stop(toastItem: StoredToastItem<data>) {
    toastItem.remaining = remaining(toastItem)
    toastItem.started = null
    clearTimeout(toastItem.timer)
  }

  function start(id: string, toastItem: StoredToastItem<data>) {
    if (toastItem.timeout === false || toastItem.presentations.size === 0 || reasons.size > 0)
      return
    toastItem.started = performance.now()
    toastItem.timer = setTimeout(() => toastManager.close(id), toastItem.remaining)
  }

  function validateTimeout(value: number | false) {
    if (value !== false && (!Number.isFinite(value) || value < 0))
      throw new RangeError('Toast timeout must be false or finite and non-negative')
    return value
  }

  class ToastStore extends TypedEventTarget<{ change: Event }> implements ToastManager<data> {
    get toastItems(): readonly ToastItem<data>[] {
      return Object.freeze(
        [...storedToastItems].reverse().map(([id, toastItem]) =>
          Object.freeze({
            id,
            revision: toastItem.revision,
            title: toastItem.options.title,
            description: toastItem.options.description,
            data: toastItem.options.data,
            timeout: toastItem.timeout,
            remaining: remaining(toastItem),
            paused: toastItem.started === null,
            presented: toastItem.presentations.size > 0,
            priority: toastItem.options.priority ?? 'low',
          }),
        ),
      )
    }
    add(options: ToastOptions<data>) {
      let id = options.id ?? `toast-${++nextId}`
      while (options.id === undefined && storedToastItems.has(id)) id = `toast-${++nextId}`
      let previous = storedToastItems.get(id)
      let lifetime = validateTimeout(
        options.timeout ??
          (typeof defaultTimeout === 'function' ? defaultTimeout(options) : defaultTimeout),
      )
      if (previous) stop(previous)
      let toastItem: StoredToastItem<data> = {
        revision: previous ? previous.revision + 1 : 0,
        options: { ...options },
        timeout: lifetime,
        remaining: lifetime === false ? 0 : lifetime,
        started: null,
        presentations: previous?.presentations ?? new Set(),
      }
      storedToastItems.set(id, toastItem)
      start(id, toastItem)
      changed()
      return id
    }
    close(id?: string) {
      if (id === undefined) {
        for (let toastItem of storedToastItems.values()) stop(toastItem)
        storedToastItems.clear()
      } else {
        let toastItem = storedToastItems.get(id)
        if (!toastItem) return
        stop(toastItem)
        storedToastItems.delete(id)
      }
      changed()
    }
    pause(reason: unknown) {
      if (reasons.has(reason)) return
      for (let toastItem of storedToastItems.values()) stop(toastItem)
      reasons.add(reason)
      changed()
    }
    resume(reason: unknown) {
      if (!reasons.delete(reason)) return
      if (reasons.size === 0) for (let [id, toastItem] of storedToastItems) start(id, toastItem)
      changed()
    }
    present(id: string, signal: AbortSignal) {
      let toastItem = storedToastItems.get(id)
      if (!toastItem || signal.aborted) return
      let token = Symbol()
      toastItem.presentations.add(token)
      if (toastItem.presentations.size === 1) start(id, toastItem)
      signal.addEventListener(
        'abort',
        () => {
          // An add with the same id replaces the stored toast item but retains its presentations.
          let current = storedToastItems.get(id)
          if (!current || !current.presentations.delete(token)) return
          if (current.presentations.size === 0) stop(current)
          changed()
        },
        { once: true },
      )
      changed()
    }
  }
  let toastManager = new ToastStore()
  return toastManager
}

type RootState = {
  readonly limit: number
  toastManager: Pick<ToastManager<unknown>, 'present' | 'close' | 'toastItems' | 'pause' | 'resume'>
  registerRoot(node: HTMLElement, options: () => ToastRootOptions, signal: AbortSignal): void
  registerItem(id: string, node: HTMLElement): void
  unregisterItem(id: string, node: HTMLElement): void
  focusGuard(previous: EventTarget | null): void
  readonly hasReturnTarget: boolean
  readonly expanded: boolean
  readonly focused: boolean
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

const mountedManagers = new WeakSet<object>()

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
 * @returns A reactive renderer for the collection and high-priority announcements.
 */
export function Context<data = unknown>(handle: Handle<ToastContextProps<data>>): () => RemixNode {
  let toastManager = handle.props.manager
  let limit = handle.props.limit ?? 3
  let region: HTMLElement | undefined
  let returnTo: HTMLElement | undefined
  let touch = Symbol('touch')
  let hover = Symbol('hover')
  let focus = Symbol('focus')
  let visibility = Symbol('visibility')
  let windowBlur = Symbol('window blur')
  let touchEngaged = false
  let hovered = false
  let focused = false
  let entering = false
  let collapseAfterExit = false
  let presentations = new Map<string, HTMLElement>()
  let previous = toastManager.toastItems.map((toastItem) => toastItem.id)

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
    for (let [id, node] of presentations) {
      if (!available.has(id) && active && contains(node, active)) {
        if (!focused && !active.matches(':focus-visible')) {
          active.blur()
          continue
        }
        let index = previous.indexOf(id)
        let candidates = [...previous.slice(index + 1), ...previous.slice(0, index).reverse()]
        let target = candidates
          .filter((candidate) => available.has(candidate))
          .map((candidate) => presentations.get(candidate))
          .find((candidate) => candidate?.isConnected && !candidate.inert)
        if (target) focusElement(target, true)
        else if (!restoreFocus()) active.blur()
      }
    }
    // Focusing a neighbour may run consumer handlers that close more notifications.
    toastItems = toastManager.toastItems
    available = new Set(toastItems.slice(0, limit).map((toastItem) => toastItem.id))
    previous = toastItems.map((toastItem) => toastItem.id)
    for (let [id, node] of presentations) {
      let unavailable = !available.has(id)
      node.inert = unavailable
      let high = toastItems.find((toastItem) => toastItem.id === id)?.priority === 'high'
      if (unavailable || (high && !focused)) node.setAttribute('aria-hidden', 'true')
      else node.removeAttribute('aria-hidden')
    }
  }

  let state: RootState = {
    toastManager,
    get limit() {
      return limit
    },
    focusGuard(previous) {
      let target =
        previous === region
          ? toastManager.toastItems
              .slice(0, limit)
              .map((toastItem) => presentations.get(toastItem.id))
              .find((node) => node?.isConnected && !node.inert)
          : undefined
      if (target) focusElement(target, true)
      else restoreFocus()
    },
    get hasReturnTarget() {
      return returnTo !== undefined
    },
    get expanded() {
      return hovered || focused || touchEngaged
    },
    get focused() {
      return focused
    },
    registerItem(id, node) {
      presentations.set(id, node)
      refresh()
    },
    unregisterItem(id, node) {
      if (presentations.get(id) !== node) return
      presentations.delete(id)
      if (
        collapseAfterExit &&
        ![...presentations.keys()].some(
          (id) => !toastManager.toastItems.some((toastItem) => toastItem.id === id),
        )
      ) {
        collapseAfterExit = false
        hovered = false
        toastManager.resume(hover)
      }
      if (!toastManager.toastItems.length) {
        collapseAfterExit = false
        touchEngaged = hovered = false
        toastManager.resume(touch)
        toastManager.resume(hover)
      }
      refresh()
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
          touchEngaged = true
          toastManager.pause(touch)
          void handle.update()
        },
        { signal },
      )
      doc.addEventListener(
        'pointerdown',
        (event) => {
          if (
            !touchEngaged ||
            event.pointerType !== 'touch' ||
            !event.isPrimary ||
            event.button !== 0 ||
            event.composedPath().includes(node)
          )
            return
          touchEngaged = hovered = false
          let active = activeElement(doc)
          if (active && contains(node, active)) active.blur()
          toastManager.resume(touch)
          toastManager.resume(hover)
          void handle.update()
        },
        { capture: true, signal },
      )
      node.addEventListener(
        'pointerenter',
        (event) => {
          if (event.pointerType === 'touch') return
          hovered = true
          collapseAfterExit = false
          toastManager.pause(hover)
          void handle.update()
        },
        { signal },
      )
      node.addEventListener(
        'pointerleave',
        () => {
          if (
            [...presentations.keys()].some(
              (id) => !toastManager.toastItems.some((toastItem) => toastItem.id === id),
            )
          ) {
            collapseAfterExit = true
            return
          }
          hovered = false
          toastManager.resume(hover)
          void handle.update()
        },
        { signal },
      )
      node.addEventListener(
        'focusin',
        (event) => {
          let active = activeElement(doc)
          if (!active || (!entering && !active.matches(':focus-visible'))) return
          if (!entering && isElement(event.relatedTarget) && !contains(node, event.relatedTarget))
            returnTo = event.relatedTarget
          focused = true
          toastManager.pause(focus)
          refresh()
          void handle.update()
        },
        { signal },
      )
      node.addEventListener(
        'focusout',
        (event) => {
          if (isElement(event.relatedTarget) && contains(node, event.relatedTarget)) return
          focused = false
          toastManager.resume(focus)
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
          focusElement(node, true)
          entering = false
          if (activeElement(doc) === node) event.preventDefault()
        },
        { signal },
      )
      function onVisibility() {
        if (doc.hidden) toastManager.pause(visibility)
        else toastManager.resume(visibility)
      }
      doc.addEventListener('visibilitychange', onVisibility, { signal })
      win?.addEventListener(
        'blur',
        (event) => {
          if (event.target === win) toastManager.pause(windowBlur)
        },
        { signal },
      )
      win?.addEventListener(
        'focus',
        (event) => {
          if (event.target === win) toastManager.resume(windowBlur)
        },
        { signal },
      )
      onVisibility()
      signal.addEventListener(
        'abort',
        () => {
          region = undefined
          returnTo = undefined
          touchEngaged = hovered = focused = false
          toastManager.resume(touch)
          toastManager.resume(hover)
          toastManager.resume(focus)
          toastManager.resume(visibility)
          toastManager.resume(windowBlur)
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
    if (mountedManagers.has(toastManager))
      throw new Error('Mount only one toast.Context per manager')
    mountedManagers.add(toastManager)
    toastManager.addEventListener('change', sync, { signal: handle.signal })
    sync()
    handle.signal.addEventListener('abort', () => mountedManagers.delete(toastManager), {
      once: true,
    })
  })
  return () => {
    let nextLimit = handle.props.limit ?? 3
    if (!Number.isInteger(nextLimit) || nextLimit < 1)
      throw new RangeError('Toast limit must be a positive integer')
    if (limit !== nextLimit) {
      limit = nextLimit
      refresh()
    }
    return (
      <ToastScope value={state}>
        {handle.props.children(toastManager.toastItems)}
        {!focused && (
          <div mix={hidden}>
            {toastManager.toastItems
              .filter((toastItem) => toastItem.presented && toastItem.priority === 'high')
              .map((toastItem) => (
                <div key={toastItem.id} role="alert" aria-atomic="true">
                  <div>{toastItem.title}</div>
                  <div>{toastItem.description}</div>
                </div>
              ))}
          </div>
        )}
      </ToastScope>
    )
  }
}

/** A named notification region with polite announcements and keyboard entry. */
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
          'aria-live': 'polite',
          'aria-atomic': 'false',
          'aria-relevant': 'additions text',
          'data-expanded': context.expanded ? '' : undefined,
        }),
        ref((node: HTMLElement, signal) => context.registerRoot(node, () => options, signal)),
      ]
    }
  },
)

function FocusGuard(handle: Handle<{ active: boolean }>) {
  let context = handle.context.get(ToastScope)
  return () => (
    <span
      tabIndex={handle.props.active ? 0 : -1}
      aria-hidden="true"
      data-toast-focus-guard=""
      mix={[hidden, on('focus', (event) => context.focusGuard(event.relatedTarget))]}
    />
  )
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

/**
 * Gives the scoped toast dialog semantics, presentation lifetime and focus recovery.
 * Without a title, supply an accessible name on the host with aria-label or aria-labelledby.
 */
export const item = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let context = handle.context.get(ToastScope)
  let scoped = handle.context.get(ItemContext)
  if (!context || !scoped) throw new Error('toast.item() must be rendered inside toast.ItemContext')
  let presentation: AbortController | undefined
  let host: HTMLElement | undefined
  function connect(node: HTMLElement) {
    presentation?.abort()
    presentation = new AbortController()
    host = node
    context.registerItem(scoped.id, node)
    context.toastManager.present(scoped.id, presentation.signal)
  }
  handle.addEventListener('insert', (event) => connect(event.node))
  handle.addEventListener('reclaimed', (event) => connect(event.node))
  handle.addEventListener('beforeRemove', () => presentation?.abort())
  function disconnect() {
    presentation?.abort()
    if (host) context.unregisterItem(scoped.id, host)
  }
  handle.addEventListener('remove', disconnect)
  handle.signal.addEventListener('abort', disconnect, { once: true })
  return () => {
    let toastItems = context.toastManager.toastItems
    let index = toastItems.findIndex((toastItem) => toastItem.id === scoped.id)
    let toastItem = toastItems[index]
    let limited = index >= context.limit
    return [
      attrs({
        inert: limited || !toastItem ? true : undefined,
        'aria-hidden':
          limited || !toastItem || (toastItem.priority === 'high' && !context.focused)
            ? 'true'
            : undefined,
        'data-limited': limited ? '' : undefined,
        role: toastItem?.priority === 'high' ? 'alertdialog' : 'dialog',
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
})

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
  let focused = false
  return (props) => [
    attrs({
      type: props.type ?? 'button',
      'aria-hidden': !context.expanded && !focused ? 'true' : undefined,
    }),
    on('focus', () => {
      focused = true
      void handle.update()
    }),
    on('blur', () => {
      focused = false
      void handle.update()
    }),
    on('click', (event) => {
      if (!event.defaultPrevented) context.toastManager.close(scoped.id)
    }),
  ]
})

let countdownPropertyRegistered = false

/**
 * Animates `--toast-countdown` from 1 to 0 using the manager's clock snapshot.
 * Style the host or its descendants to turn this fraction into a decorative countdown indicator.
 * @param clock Current timer state from the collection callback. Persistent toasts hide the indicator.
 * @returns A mixin that updates a native animation only when timer state changes.
 */
export const countdown = createMixin<
  HTMLElement,
  [clock: Pick<ToastItem<unknown>, 'timeout' | 'remaining' | 'paused'>],
  ElementProps
>((handle) => {
  let clock: Pick<ToastItem<unknown>, 'timeout' | 'remaining' | 'paused'>
  let animation: Animation | undefined
  handle.addEventListener('remove', () => animation?.cancel())
  function synchronize() {
    handle.queueTask((node) => {
      if (!countdownPropertyRegistered) {
        CSS.registerProperty({
          name: '--toast-countdown',
          syntax: '<number>',
          inherits: true,
          initialValue: '1',
        })
        countdownPropertyRegistered = true
      }
      animation?.cancel()
      if (clock.timeout === false) return
      animation = node.animate([{ '--toast-countdown': '1' }, { '--toast-countdown': '0' }], {
        duration: clock.timeout,
        fill: 'both',
        easing: 'linear',
      })
      animation.currentTime = clock.timeout - clock.remaining
      if (clock.paused) animation.pause()
    })
  }
  return (nextClock) => {
    clock = nextClock
    synchronize()
    return attrs({ 'aria-hidden': 'true', hidden: clock.timeout === false })
  }
})
