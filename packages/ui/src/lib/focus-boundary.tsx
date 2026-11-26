import { css, on, ref, type Handle, type RemixNode } from '@remix-run/component'

export function getActiveElement(doc: Document): Element | null {
  let active = doc.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

export type FocusTransport = {
  owner: object
  children: Set<FocusTransport>
  readonly active: boolean
  restoreFocus: boolean
  readonly navigable: boolean
  contains(node: Node | null): boolean
  restore(): void
  register(boundary: SurfaceBoundaryRegistration): () => void
  route(direction: 1 | -1, inlineOrigin?: HTMLElement): void
  update(): void
}

export function FocusPortalScope(
  handle: Handle<{ value: FocusTransport; children?: RemixNode }, FocusTransport>,
) {
  handle.context.set(handle.props.value)
  return () => handle.props.children
}

export function SurfacePortalOwner(
  handle: Handle<
    { owner: object; surfaceOwner: object; children?: RemixNode },
    { owner: object; surfaceOwner: object }
  >,
) {
  handle.context.set({ owner: handle.props.owner, surfaceOwner: handle.props.surfaceOwner })
  return () => handle.props.children
}

type FocusGuardProps = {
  active: boolean
  onFocus(event: FocusEvent & { currentTarget: HTMLElement }): void
  onRef?: (node: HTMLElement, signal: AbortSignal) => void
}

// Patterns own focus policy. This component only renders the accessible boundary sensor.
export function FocusGuard(handle: Handle<FocusGuardProps>) {
  let voiceOverWebKit = false
  return () => {
    let role: 'button' | undefined = handle.props.active && voiceOverWebKit ? 'button' : undefined
    return (
      <span
        tabIndex={handle.props.active ? 0 : -1}
        role={role}
        aria-hidden={role ? undefined : 'true'}
        data-rmx-focus-guard=""
        mix={[
          css({
            position: 'fixed',
            width: 1,
            height: 1,
            padding: 0,
            overflow: 'hidden',
            clipPath: 'inset(50%)',
            whiteSpace: 'nowrap',
          }),
          ref((node: HTMLElement, signal) => {
            let win = node.ownerDocument.defaultView
            let platform = win?.navigator.platform.toLowerCase() ?? ''
            // WebKit needs role-button guards for VoiceOver's virtual cursor to dispatch focus.
            let next =
              (platform.startsWith('mac') || /^i(os$|p)/.test(platform)) &&
              Boolean(win?.CSS.supports?.('-webkit-backdrop-filter:none'))
            if (voiceOverWebKit !== next) {
              voiceOverWebKit = next
              void handle.update()
            }
            handle.props.onRef?.(node, signal)
          }),
          on('focus', (event) => handle.props.onFocus(event)),
        ]}
      />
    )
  }
}

export type SurfaceBoundaryRegistration = {
  node: HTMLElement
  owner: object
  portalOwner: object
  readonly active: boolean
  before: HTMLElement
  after: HTMLElement
  cross(direction: 1 | -1): void
  update(
    active: boolean,
    onFocus?: (guard: HTMLElement, previous: EventTarget | null, direction?: 1 | -1) => void,
  ): void
}

type SurfaceBoundaryValue = {
  portal: FocusTransport | undefined
  owner: object
  registerSurface(node: HTMLElement, signal: AbortSignal): void
}

const boundaries = new WeakMap<Document, Set<SurfaceBoundaryRegistration>>()
const observers = new WeakMap<Document, Set<() => void>>()

export function getSurfaceBoundaries(doc: Document): SurfaceBoundaryRegistration[] {
  return Array.from(boundaries.get(doc) ?? [])
}

export function observeSurfaceBoundaries(doc: Document, callback: () => void): () => void {
  let callbacks = observers.get(doc)
  if (!callbacks) {
    callbacks = new Set()
    observers.set(doc, callbacks)
  }
  callbacks.add(callback)
  return () => {
    callbacks.delete(callback)
    if (!callbacks.size) observers.delete(doc)
  }
}

function notify(doc: Document) {
  for (let callback of observers.get(doc) ?? []) callback()
}

// Providers place this boundary at the surface's DOM destination, independently of its opener.
export function SurfaceBoundary(
  handle: Handle<{ owner: object; children?: RemixNode }, SurfaceBoundaryValue>,
): () => RemixNode {
  let candidate = handle.context.get(FocusPortalScope)
  let mapped = handle.context.get(SurfacePortalOwner)
  let portalOwner = mapped?.surfaceOwner === handle.props.owner ? mapped.owner : handle.props.owner
  let transport = candidate?.owner === portalOwner ? candidate : undefined
  let releaseTransport = () => {}
  let surface: HTMLElement | undefined
  let before: HTMLElement | undefined
  let after: HTMLElement | undefined
  let registration: SurfaceBoundaryRegistration | undefined
  let active = false
  let onFocus:
    | ((guard: HTMLElement, previous: EventTarget | null, direction?: 1 | -1) => void)
    | undefined

  function unregister() {
    if (!registration) return
    releaseTransport()
    let doc = registration.node.ownerDocument
    let registered = boundaries.get(doc)
    registered?.delete(registration)
    if (!registered?.size) boundaries.delete(doc)
    registration = undefined
    active = false
    onFocus = undefined
    if (!handle.signal.aborted) void handle.update()
    notify(doc)
  }

  function register() {
    if (registration || !surface || !before || !after) return
    let doc = surface.ownerDocument
    if (
      before.parentNode !== after.parentNode ||
      !before.parentNode?.contains(surface) ||
      !(before.compareDocumentPosition(surface) & Node.DOCUMENT_POSITION_FOLLOWING) ||
      !(after.compareDocumentPosition(surface) & Node.DOCUMENT_POSITION_PRECEDING)
    ) {
      // Queue errors through the component runtime rather than throwing from insertion events.
      handle.queueTask(() => {
        throw new Error(
          'SurfaceContext must wrap its surface at the DOM destination. Place it inside Portal.',
        )
      })
      queueMicrotask(() => {
        if (!handle.signal.aborted) void handle.update()
      })
      return
    }
    registration = {
      node: surface,
      owner: handle.props.owner,
      portalOwner,
      get active() {
        return active || !!transport?.navigable
      },
      before,
      after,
      cross(direction) {
        let guard = direction === 1 ? after : before
        if (guard) onFocus?.(guard, getActiveElement(doc), direction)
      },
      update(nextActive, nextOnFocus) {
        onFocus = nextOnFocus
        if (active === nextActive) return
        active = nextActive
        if (!handle.signal.aborted) void handle.update()
      },
    }
    let registered = boundaries.get(doc)
    if (!registered) {
      registered = new Set()
      boundaries.set(doc, registered)
    }
    registered.add(registration)
    if (transport) releaseTransport = transport.register(registration)
    notify(doc)
  }

  handle.context.set({
    portal: transport,
    owner: handle.props.owner,
    registerSurface(node, signal) {
      if (surface && surface !== node) throw new Error('SurfaceContext supports one surface')
      surface = node
      register()
      signal.addEventListener(
        'abort',
        () => {
          unregister()
          surface = undefined
        },
        { once: true },
      )
    },
  })
  handle.signal.addEventListener('abort', unregister, { once: true })

  return () => (
    <>
      <FocusGuard
        active={registration?.active ?? false}
        onRef={(node, signal) => {
          before = node
          register()
          signal.addEventListener(
            'abort',
            () => {
              unregister()
              before = undefined
            },
            { once: true },
          )
        }}
        onFocus={(event) => {
          if (
            transport?.navigable &&
            surface &&
            event.relatedTarget instanceof Node &&
            transport.contains(event.relatedTarget)
          ) {
            transport.route(event.currentTarget === before ? -1 : 1)
          } else onFocus?.(event.currentTarget, event.relatedTarget)
        }}
      />
      {handle.props.children}
      <FocusGuard
        active={registration?.active ?? false}
        onRef={(node, signal) => {
          after = node
          register()
          signal.addEventListener(
            'abort',
            () => {
              unregister()
              after = undefined
            },
            { once: true },
          )
        }}
        onFocus={(event) => {
          if (
            transport?.navigable &&
            surface &&
            event.relatedTarget instanceof Node &&
            transport.contains(event.relatedTarget)
          ) {
            transport.route(event.currentTarget === before ? -1 : 1)
          } else onFocus?.(event.currentTarget, event.relatedTarget)
        }}
      />
    </>
  )
}
