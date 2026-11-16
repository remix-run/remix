import { css, ref, type Handle, type RemixNode } from '@remix-run/component'
import { focusable, tabbable } from 'tabbable'
import { Portal } from '../portal.tsx'
import { contains } from './contains.ts'
import {
  FocusGuard,
  activeElement,
  FocusPortalScope,
  getSurfaceBoundaries,
  type FocusTransport,
  type SurfaceBoundaryRegistration,
} from './focus.tsx'

type PortalOptions = {
  componentName: string
  owner: object
  open(): boolean
  reference(): HTMLElement | null | undefined
  mode: 'navigate' | 'trap' | 'virtual'
  ownerRole?: 'group'
  children?: RemixNode
  container?: HTMLElement | null
}

const transports = new WeakMap<object, FocusTransport>()

export function leaveFocusPortal(
  owner: object,
  event: KeyboardEvent,
  close?: () => void,
  inlineRootTrigger?: HTMLElement,
): boolean {
  let transport = transports.get(owner)
  if (!transport?.active || event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey)
    return false
  transport.restoreFocus = false
  if (inlineRootTrigger) {
    // A portaled submenu can belong to an inline root. Re-establish the native
    // navigation start point at that root, rather than at the submenu destination.
    inlineRootTrigger.focus()
    if (event.shiftKey) event.preventDefault()
    if (close) void close()
    return true
  }
  event.preventDefault()
  let direction: 1 | -1 = event.shiftKey ? -1 : 1
  if (close) void close()
  transport.route(direction)
  return true
}

export function FocusPortal(handle: Handle<PortalOptions>): () => RemixNode {
  let parent = handle.context.get(FocusPortalScope)
  let before: HTMLElement | undefined
  let after: HTMLElement | undefined
  let destination: HTMLElement | undefined
  let destinationId = `${handle.id}-portal`
  let boundaries = new Set<SurfaceBoundaryRegistration>()
  let saved = new Map<Element, string | null>()
  let observing = false
  let disposed = false
  let routing = false
  let ready = false
  let renderedNavigation = false
  let previouslyOpen = false
  let observer: MutationObserver | undefined
  let transport: FocusTransport

  function recordChanges(records: MutationRecord[]) {
    for (let record of records) {
      if (
        record.type === 'attributes' &&
        record.attributeName === 'tabindex' &&
        record.target instanceof Element &&
        saved.has(record.target)
      )
        saved.set(record.target, record.target.getAttribute('tabindex'))
    }
  }

  function disconnect() {
    if (observer) recordChanges(observer.takeRecords())
    observer?.disconnect()
  }

  function observe() {
    disconnect()
    if (
      !observing ||
      disposed ||
      !transport.active ||
      handle.props.mode === 'trap' ||
      (before && transport.contains(activeElement(before.ownerDocument)))
    )
      return
    for (let boundary of boundaries) {
      let roots: (Element | ShadowRoot)[] = [boundary.node]
      for (let root of roots) {
        if (root instanceof Element && root.shadowRoot) roots.push(root.shadowRoot)
        for (let node of root.querySelectorAll('*')) {
          if (node.shadowRoot) roots.push(node.shadowRoot)
        }
        observer?.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: [
            'tabindex',
            'disabled',
            'hidden',
            'style',
            'class',
            'href',
            'contenteditable',
            'controls',
            'inert',
            'open',
            'type',
            'name',
            'checked',
          ],
        })
      }
    }
  }

  function restore() {
    disconnect()
    for (let [node, value] of saved) {
      let boundary = Array.from(boundaries).find(
        (boundary) => boundary.before === node || boundary.after === node,
      )
      if (boundary) {
        node.setAttribute('tabindex', boundary.active ? '0' : '-1')
        continue
      }
      if (value === null) node.removeAttribute('tabindex')
      else node.setAttribute('tabindex', value)
    }
    saved.clear()
    observe()
  }

  function synchronize() {
    if (disposed || !before) return
    if (transport.active && !previouslyOpen) transport.restoreFocus = true
    previouslyOpen = transport.active
    if (renderedNavigation !== transport.navigable) {
      renderedNavigation = transport.navigable
      void handle.update()
    }
    if (
      !transport.active ||
      handle.props.mode === 'trap' ||
      transport.contains(activeElement(before.ownerDocument))
    ) {
      restore()
      return
    }
    disconnect()
    for (let [node, value] of saved) {
      if (
        Array.from(boundaries).some(
          (boundary) =>
            contains(boundary.node, node) || boundary.before === node || boundary.after === node,
        )
      )
        continue
      if (value === null) node.removeAttribute('tabindex')
      else node.setAttribute('tabindex', value)
      saved.delete(node)
    }
    for (let boundary of boundaries) {
      for (let node of [
        // Suppress potential Tab stops too: excluding unchecked radios can make them
        // tabbable as soon as their checked peer receives tabindex=-1.
        ...focusable(boundary.node, { getShadowRoot: true }).filter((node) => node.tabIndex >= 0),
        ...[boundary.before, boundary.after].filter((node) => node.tabIndex >= 0),
      ]) {
        if (!saved.has(node)) saved.set(node, node.getAttribute('tabindex'))
        node.setAttribute('tabindex', '-1')
      }
    }
    observe()
  }

  function content(direction: 1 | -1) {
    transport.restore()
    let candidates = Array.from(boundaries).flatMap((boundary) =>
      tabbable(boundary.node, { getShadowRoot: true }).filter(
        (node) => !node.hasAttribute('data-rmx-focus-guard'),
      ),
    )
    let target = direction === 1 ? candidates[0] : candidates.at(-1)
    if (target) target.focus()
    else transport.route(direction)
  }

  function onOrigin(direction: 1 | -1, event: FocusEvent) {
    if (!transport.navigable || routing) return
    if (event.relatedTarget instanceof Node && transport.contains(event.relatedTarget))
      transport.route(direction)
    else content(direction === 1 ? -1 : 1)
  }

  transport = {
    owner: handle.props.owner,
    restoreFocus: true,
    children: new Set(),
    get active() {
      return handle.props.open()
    },
    get navigable() {
      return (
        ready &&
        !!destination?.isConnected &&
        boundaries.size > 0 &&
        handle.props.open() &&
        handle.props.mode === 'navigate'
      )
    },
    contains(node) {
      return (
        !!node &&
        (Array.from(boundaries).some(
          (boundary) =>
            contains(boundary.node, node) || boundary.before === node || boundary.after === node,
        ) ||
          Array.from(transport.children).some((child) => child.contains(node)))
      )
    },
    restore() {
      parent?.restore()
      restore()
    },
    register(boundary) {
      if (boundary.portalOwner !== transport.owner)
        throw new Error(`${handle.props.componentName} requires a matching surface context`)
      if (boundaries.size) throw new Error(`${handle.props.componentName} supports one surface`)
      boundaries.add(boundary)
      observing = true
      observe()
      queueMicrotask(() => transport.update())
      return () => {
        restore()
        boundaries.delete(boundary)
        observe()
      }
    },
    route(direction) {
      transport.restore()
      let origin = direction === 1 ? after : before
      if (!origin) return
      let candidates = tabbable(origin.ownerDocument.body, { getShadowRoot: true }).filter(
        (node) => !transport.contains(node),
      )
      let reference = origin.parentElement?.closest('[inert], [aria-hidden="true"]')
        ? (handle.props.reference() ?? origin)
        : origin
      let ordered = direction === 1 ? candidates : candidates.toReversed()
      let target = ordered.find(
        (node) =>
          !!(
            reference.compareDocumentPosition(node) &
            (direction === 1 ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)
          ),
      )
      // Focusing the adjacent origin guard first keeps the browser's navigation start point
      // at the declaration when no document control follows it.
      let boundary = getSurfaceBoundaries(origin.ownerDocument).find(
        (boundary) => boundary.active && (boundary.before === target || boundary.after === target),
      )
      if (boundary) boundary.cross(direction)
      else if (target) target.focus()
      else {
        routing = true
        origin.focus()
        origin.blur()
        routing = false
      }
      synchronize()
    },
    update() {
      void handle.update()
      queueMicrotask(synchronize)
    },
  }
  parent?.children.add(transport)
  let previous = transports.get(transport.owner)
  if (previous)
    throw new Error(`Only one ${handle.props.componentName} can be rendered per Context`)
  transports.set(transport.owner, transport)

  function focusChanged() {
    synchronize()
  }
  handle.signal.addEventListener(
    'abort',
    () => {
      disposed = true
      observing = false
      restore()
      observer?.disconnect()
      before?.ownerDocument.removeEventListener('focusin', focusChanged, true)
      parent?.children.delete(transport)
      transports.delete(transport.owner)
    },
    { once: true },
  )

  return () => {
    handle.queueTask(() => {
      if (!before) return
      let doc = before.ownerDocument
      let container = handle.props.container ?? doc.body
      if (before.getRootNode() !== doc || container.getRootNode() !== doc) {
        throw new Error(
          `${handle.props.componentName} requires its declaration and container to be in the same document, outside shadow roots`,
        )
      }
    })
    renderedNavigation = transport.navigable
    queueMicrotask(synchronize)
    return (
      <>
        <FocusGuard
          active={transport.navigable}
          onRef={(node) => {
            before = node
            if (!ready) {
              ready = true
              queueMicrotask(() => transport.update())
            }
            if (!observer) {
              let Observer = node.ownerDocument.defaultView?.MutationObserver ?? MutationObserver
              observer = new Observer((records) => {
                recordChanges(records)
                synchronize()
              })
              node.ownerDocument.addEventListener('focusin', focusChanged, true)
            }
          }}
          onFocus={(event) => onOrigin(-1, event)}
        />
        {transport.navigable ? (
          <span
            role={handle.props.ownerRole}
            aria-owns={destinationId}
            mix={css({
              position: 'fixed',
              width: 1,
              height: 1,
              padding: 0,
              overflow: 'hidden',
              clipPath: 'inset(50%)',
              whiteSpace: 'nowrap',
            })}
          />
        ) : null}
        <Portal container={handle.props.container}>
          {/* A display:contents destination cannot be reparented by aria-owns in Chromium. */}
          <div
            id={destinationId}
            mix={ref((node: HTMLElement, signal) => {
              destination = node
              queueMicrotask(() => transport.update())
              signal.addEventListener('abort', () => {
                destination = undefined
                if (!handle.signal.aborted) transport.update()
              })
            })}
          >
            <FocusPortalScope value={transport}>{handle.props.children}</FocusPortalScope>
          </div>
        </Portal>
        <FocusGuard
          active={transport.navigable}
          onRef={(node) => {
            after = node
          }}
          onFocus={(event) => onOrigin(1, event)}
        />
      </>
    )
  }
}
