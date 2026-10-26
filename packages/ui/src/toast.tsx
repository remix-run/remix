import { attrs, createMixin, css, on, ref, TypedEventTarget } from '@remix-run/component'
import type { ElementProps, Handle, RemixNode } from '@remix-run/component'

/** Content published to a toast manager. */
export interface ToastOptions<action = RemixNode> {
  /** Stable identity. Adding the same identity updates the existing toast and restarts its timer. */
  id?: string
  /** Renderable heading content. Connect its element with `title()`. */
  title?: RemixNode
  /** Renderable supporting content. Connect its element with `description()`. */
  description?: RemixNode
  /** Consumer-defined action content. Any value except null or undefined counts as an action. */
  action?: action
  /** Visible lifetime in milliseconds. Zero persists. Defaults to 5000, or zero with an action. */
  duration?: number
  /** Announcement urgency. Defaults to low (polite); high uses an assertive alert. */
  priority?: 'low' | 'high'
}

/** An immutable snapshot. Read the manager again to obtain the current remaining time. */
export interface ToastRecord<action = RemixNode> {
  /** Stable identity, including generated identities. */
  readonly id: string
  /** Visible heading. */
  readonly title?: RemixNode
  /** Supporting content. */
  readonly description?: RemixNode
  /** Content interpreted by the consumer's renderer. */
  readonly action?: action
  /** Configured lifetime in milliseconds, or zero for a persistent toast. */
  readonly duration: number
  /** Remaining visible time in milliseconds, sampled when this snapshot was read. */
  readonly remaining: number
  /** Whether the timer is stopped, including while no item presents the toast. */
  readonly paused: boolean
  /** Whether at least one mounted item presents this toast. */
  readonly presented: boolean
  /** Announcement urgency, independent of action presence and duration. */
  readonly priority: 'low' | 'high'
  /** Outside the manager's visible limit. Retain the item in the DOM for transitions. */
  readonly limited: boolean
}

/** Commands and observable state, without a bound component. Events signal that state can be read. */
export interface ToastManager<action = RemixNode> extends TypedEventTarget<{ change: Event }> {
  /** Open toasts, newest first. Updating an existing identity preserves its position. */
  readonly toasts: readonly ToastRecord<action>[]
  /** Maximum available toasts. Overflow remains in the collection and its timers keep running. */
  readonly limit: number
  /** Adds or merges a toast by identity, returning its identity. */
  add(options: ToastOptions<action>): string
  /** Updates an open toast. Only an explicit duration restarts its timer. */
  update(id: string, options: Partial<Omit<ToastOptions<action>, 'id'>>): void
  /** Closes one toast, or all toasts when no identity is supplied. */
  close(id?: string): void
  /** Pauses all timers for an opaque reason. New arrivals inherit active reasons. */
  pause(reason: unknown): void
  /** Removes just this pause reason. Other reasons continue to pause timers. */
  resume(reason: unknown): void
  /** Presents an item for the signal's lifetime. Multiple presentations share one timer. */
  present(id: string, signal: AbortSignal): void
}

/** Notification policy shared independently of rendering. */
export interface ToastManagerOptions {
  /** Maximum available toasts. Defaults to 3. Must be a positive integer. */
  limit?: number
}

/** Connects application-level state to consumer-owned markup. */
export interface ToastContextProps<action = RemixNode> {
  /** Stable manager created outside the rendering component. */
  manager: ToastManager<action>
  /** Renders every open toast, including limited records, newest first. */
  children: (toasts: readonly ToastRecord<action>[]) => RemixNode
}

/** Region behavior. Author its element, translated label and positioning. */
export interface ToastRootOptions {
  /** Accessible name for the notification region. */
  label: string
  /** Unmodified key for entering and leaving the region. Defaults to F6. False disables it. */
  hotkey?: string | false
}

/** Scopes one notification's content and controls. */
export interface ToastItemContextProps<action = RemixNode> {
  /** Current notification from the manager's collection. Keep the provider keyed by its id. */
  toast: ToastRecord<action>
  /** Consumer-owned notification markup. */
  children?: RemixNode
}

type StoredToast<action> = {
  options: ToastOptions<action>
  duration: number
  remaining: number
  started: number | null
  timer?: ReturnType<typeof setTimeout>
  presentations: Set<symbol>
}

/**
 * Creates retained toast state independently of rendering. Timers run only while presented.
 * @param options Notification policy applied independently of rendering.
 * @returns A manager with native EventTarget subscriptions.
 */
export function createToastManager<action = RemixNode>(
  options: ToastManagerOptions = {},
): ToastManager<action> {
  let limit = options.limit ?? 3
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError('Toast limit must be a positive integer')
  let records = new Map<string, StoredToast<action>>()
  let reasons = new Set<unknown>()
  let nextId = 0

  function changed() {
    manager.dispatchEvent(new Event('change'))
  }

  function remaining(record: StoredToast<action>) {
    return Math.max(
      0,
      record.remaining - (record.started === null ? 0 : performance.now() - record.started),
    )
  }

  function stop(record: StoredToast<action>) {
    record.remaining = remaining(record)
    record.started = null
    clearTimeout(record.timer)
  }

  function start(id: string, record: StoredToast<action>) {
    if (record.duration === 0 || record.presentations.size === 0 || reasons.size > 0) return
    record.started = performance.now()
    record.timer = setTimeout(() => manager.close(id), record.remaining)
  }

  function duration(options: ToastOptions<action>) {
    let value = options.duration ?? (options.action == null ? 5000 : 0)
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError('Toast duration must be finite and non-negative')
    return value
  }

  class ToastStore extends TypedEventTarget<{ change: Event }> implements ToastManager<action> {
    get limit() {
      return limit
    }
    get toasts(): readonly ToastRecord<action>[] {
      return Object.freeze(
        [...records].reverse().map(([id, record], index) =>
          Object.freeze({
            id,
            title: record.options.title,
            description: record.options.description,
            action: record.options.action,
            duration: record.duration,
            remaining: remaining(record),
            paused: record.started === null,
            presented: record.presentations.size > 0,
            priority: record.options.priority ?? 'low',
            limited: index >= limit,
          }),
        ),
      )
    }
    add(options: ToastOptions<action>) {
      let id = options.id ?? `toast-${++nextId}`
      while (options.id === undefined && records.has(id)) id = `toast-${++nextId}`
      let previous = records.get(id)
      let merged = { ...previous?.options, ...options }
      let lifetime = duration(merged)
      if (previous) stop(previous)
      let record: StoredToast<action> = {
        options: merged,
        duration: lifetime,
        remaining: lifetime,
        started: null,
        presentations: previous?.presentations ?? new Set(),
      }
      records.set(id, record)
      start(id, record)
      changed()
      return id
    }
    update(id: string, options: Partial<Omit<ToastOptions<action>, 'id'>>) {
      let record = records.get(id)
      if (!record) return
      let merged = { ...record.options, ...options }
      let lifetime = duration(merged)
      if (options.duration !== undefined) {
        stop(record)
        record.duration = lifetime
        record.remaining = lifetime
      }
      record.options = merged
      if (options.duration !== undefined) start(id, record)
      changed()
    }
    close(id?: string) {
      if (id === undefined) {
        for (let record of records.values()) stop(record)
        records.clear()
      } else {
        let record = records.get(id)
        if (!record) return
        stop(record)
        records.delete(id)
      }
      changed()
    }
    pause(reason: unknown) {
      if (reasons.has(reason)) return
      for (let record of records.values()) stop(record)
      reasons.add(reason)
      changed()
    }
    resume(reason: unknown) {
      if (!reasons.delete(reason)) return
      if (reasons.size === 0) for (let [id, record] of records) start(id, record)
      changed()
    }
    present(id: string, signal: AbortSignal) {
      let record = records.get(id)
      if (!record || signal.aborted) return
      let token = Symbol()
      record.presentations.add(token)
      if (record.presentations.size === 1) start(id, record)
      signal.addEventListener(
        'abort',
        () => {
          // An add with the same id replaces the stored record but retains its presentations.
          let current = records.get(id)
          if (!current || !current.presentations.delete(token)) return
          if (current.presentations.size === 0) stop(current)
          changed()
        },
        { once: true },
      )
      changed()
    }
  }
  let manager = new ToastStore()
  return manager
}

type RootState = {
  manager: Pick<ToastManager<unknown>, 'present' | 'close' | 'toasts' | 'pause' | 'resume'>
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
  readonly toast: ToastRecord<unknown> | undefined
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
export function Context<action = RemixNode>(
  handle: Handle<ToastContextProps<action>>,
): () => RemixNode {
  let manager = handle.props.manager
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
  let previous = manager.toasts.map((toast) => toast.id)

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
    let toasts = manager.toasts
    let available = new Set(toasts.filter((toast) => !toast.limited).map((toast) => toast.id))
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
    toasts = manager.toasts
    available = new Set(toasts.filter((toast) => !toast.limited).map((toast) => toast.id))
    previous = toasts.map((toast) => toast.id)
    for (let [id, node] of presentations) {
      let unavailable = !available.has(id)
      node.inert = unavailable
      let high = toasts.find((toast) => toast.id === id)?.priority === 'high'
      if (unavailable || (high && !focused)) node.setAttribute('aria-hidden', 'true')
      else node.removeAttribute('aria-hidden')
    }
  }

  let state: RootState = {
    manager,
    focusGuard(previous) {
      let target =
        previous === region
          ? manager.toasts
              .filter((toast) => !toast.limited)
              .map((toast) => presentations.get(toast.id))
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
        ![...presentations.keys()].some((id) => !manager.toasts.some((toast) => toast.id === id))
      ) {
        collapseAfterExit = false
        hovered = false
        manager.resume(hover)
      }
      if (!manager.toasts.length) {
        collapseAfterExit = false
        touchEngaged = hovered = false
        manager.resume(touch)
        manager.resume(hover)
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
          manager.pause(touch)
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
          manager.resume(touch)
          manager.resume(hover)
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
          manager.pause(hover)
          void handle.update()
        },
        { signal },
      )
      node.addEventListener(
        'pointerleave',
        () => {
          if (
            [...presentations.keys()].some((id) => !manager.toasts.some((toast) => toast.id === id))
          ) {
            collapseAfterExit = true
            return
          }
          hovered = false
          manager.resume(hover)
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
          manager.pause(focus)
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
          manager.resume(focus)
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
          if (!manager.toasts.some((toast) => !toast.limited) || contains(node, activeElement(doc)))
            return
          returnTo = activeElement(doc) ?? doc.body
          entering = true
          focusElement(node, true)
          entering = false
          if (activeElement(doc) === node) event.preventDefault()
        },
        { signal },
      )
      function onVisibility() {
        if (doc.hidden) manager.pause(visibility)
        else manager.resume(visibility)
      }
      doc.addEventListener('visibilitychange', onVisibility, { signal })
      win?.addEventListener(
        'blur',
        (event) => {
          if (event.target === win) manager.pause(windowBlur)
        },
        { signal },
      )
      win?.addEventListener(
        'focus',
        (event) => {
          if (event.target === win) manager.resume(windowBlur)
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
          manager.resume(touch)
          manager.resume(hover)
          manager.resume(focus)
          manager.resume(visibility)
          manager.resume(windowBlur)
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
    if (mountedManagers.has(manager)) throw new Error('Mount only one toast.Context per manager')
    mountedManagers.add(manager)
    manager.addEventListener('change', sync, { signal: handle.signal })
    sync()
    handle.signal.addEventListener('abort', () => mountedManagers.delete(manager), { once: true })
  })
  return () => (
    <ToastScope value={state}>
      {handle.props.children(manager.toasts)}
      {!focused && (
        <div mix={hidden}>
          {manager.toasts
            .filter((toast) => toast.presented && toast.priority === 'high')
            .map((toast) => (
              <div key={toast.id} role="alert" aria-atomic="true">
                <div>{toast.title}</div>
                <div>{toast.description}</div>
              </div>
            ))}
        </div>
      )}
    </ToastScope>
  )
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
 * @param handle Current notification and consumer-owned markup.
 * @returns The notification's markup with shared item context.
 */
export function ItemContext<action = RemixNode>(
  handle: Handle<ToastItemContextProps<action>, ItemState>,
): () => RemixNode {
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
      return handle.props.toast.id
    },
    get toast() {
      return context.manager.toasts.find((toast) => toast.id === handle.props.toast.id)
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
    let available = context.manager.toasts.filter((toast) => !toast.limited)
    let first = available[0]?.id === handle.props.toast.id
    let last = available.at(-1)?.id === handle.props.toast.id
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
    context.manager.present(scoped.id, presentation.signal)
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
    let toast = scoped.toast
    return [
      attrs({
        inert: toast?.limited || !toast ? true : undefined,
        'aria-hidden':
          toast?.limited || !toast || (toast.priority === 'high' && !context.focused)
            ? 'true'
            : undefined,
        'data-limited': toast?.limited ? '' : undefined,
        role: toast?.priority === 'high' ? 'alertdialog' : 'dialog',
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
        context.manager.close(scoped.id)
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
      if (!event.defaultPrevented) context.manager.close(scoped.id)
    }),
  ]
})

let countdownPropertyRegistered = false

/**
 * Animates `--toast-remaining` from 1 to 0 using the manager's clock snapshot.
 * Style the host or its descendants to turn this fraction into a decorative countdown indicator.
 * @param clock Current timer state from the collection callback. Persistent toasts hide the indicator.
 * @returns A mixin that updates a native animation only when timer state changes.
 */
export const countdown = createMixin<
  HTMLElement,
  [clock: Pick<ToastRecord<unknown>, 'duration' | 'remaining' | 'paused'>],
  ElementProps
>((handle) => {
  let clock: Pick<ToastRecord<unknown>, 'duration' | 'remaining' | 'paused'>
  let animation: Animation | undefined
  handle.addEventListener('remove', () => animation?.cancel())
  function synchronize() {
    handle.queueTask((node) => {
      if (!countdownPropertyRegistered) {
        CSS.registerProperty({
          name: '--toast-remaining',
          syntax: '<number>',
          inherits: true,
          initialValue: '1',
        })
        countdownPropertyRegistered = true
      }
      animation?.cancel()
      if (clock.duration === 0) return
      animation = node.animate([{ '--toast-remaining': '1' }, { '--toast-remaining': '0' }], {
        duration: clock.duration,
        fill: 'both',
        easing: 'linear',
      })
      animation.currentTime = clock.duration - clock.remaining
      if (clock.paused) animation.pause()
    })
  }
  return (nextClock) => {
    clock = nextClock
    synchronize()
    return attrs({ 'aria-hidden': 'true', hidden: clock.duration === 0 })
  }
})
