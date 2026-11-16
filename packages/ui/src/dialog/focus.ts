import { isFocusable, tabbable } from 'tabbable'
import { activeElement, getSurfaceBoundaries, observeSurfaceBoundaries } from '../lib/focus.tsx'
import { contains } from '../lib/contains.ts'
import {
  getDismissableLayerBranch,
  liveRegionSelector,
  observeDismissableLayers,
  notifyModalExemptRegionsOfScopeClose,
  getModalExemptRegions,
  isInModalExemptRegion,
  observeModalExemptRegions,
} from '../lib/dismissable-layer.ts'

type FocusScopeOptions = {
  modal: boolean | 'trap-focus'
  initialFocus?: HTMLElement | false | null
  returnFocus?: HTMLElement | false | null | (() => HTMLElement | false | null)
  hasExplicitReturnFocus?: () => boolean
  getBackdrop?: () => HTMLElement | null
  onFocusOutside?: (event: FocusEvent) => void
}

type FocusScope = {
  node: HTMLElement
  options: FocusScopeOptions
  lastFocused: Element | null
  previous: FocusScope | undefined
  disposed: boolean
  getReturnTarget(): Element | false | null
}

const managers = new WeakMap<Document, ReturnType<typeof createManager>>()

export function activateFocusScope(
  node: HTMLElement,
  options: FocusScopeOptions,
): {
  update(options: { modal: boolean | 'trap-focus' }): void
  dispose(options?: { restoreFocus?: boolean; closingBranch?: HTMLElement[] }): void
} {
  if (options.modal) validateBoundaries(node)
  let doc = node.ownerDocument
  let previouslyFocused = activeElement(doc)
  let manager = managers.get(doc)
  if (!manager) {
    manager = createManager(doc)
    managers.set(doc, manager)
  }

  let scope: FocusScope = {
    node,
    options: { ...options },
    lastFocused: null,
    previous: undefined,
    disposed: false,
    getReturnTarget() {
      let target =
        typeof options.returnFocus === 'function' ? options.returnFocus() : options.returnFocus
      return target ?? previouslyFocused
    },
  }
  manager.add(scope)
  if (options.initialFocus !== false) {
    if (!focus(options.initialFocus ?? tabbable(node, { getShadowRoot: true })[0] ?? node)) {
      focus(node)
    }
  }

  return {
    update({ modal }) {
      if (scope.disposed) return
      manager.update(scope, modal)
    },
    dispose({ restoreFocus = true, closingBranch = getDismissableLayerBranch(node) } = {}) {
      if (scope.disposed) return
      scope.disposed = true
      let returnTarget = restoreFocus ? scope.getReturnTarget() : false
      scope.getReturnTarget = () => returnTarget
      let wasCurrent = manager.remove(scope)
      let target = returnTarget
      // A child can finish its exit after an ancestor has been hidden or removed.
      for (
        let previous = scope.previous;
        previous && target !== false;
        previous = previous.previous
      ) {
        if (!previous.disposed) {
          if (contains(previous.node, target)) break
        } else if (!target?.isConnected || contains(previous.node, target)) {
          target = previous.getReturnTarget()
        }
      }
      notifyModalExemptRegionsOfScopeClose(node, closingBranch, target)
      if (
        wasCurrent &&
        restoreFocus &&
        (options.hasExplicitReturnFocus?.() || !isInModalExemptRegion(doc, activeElement(doc)))
      ) {
        manager.restoreFocus(target)
      }
    },
  }
}

function createManager(doc: Document) {
  let scopes: FocusScope[] = []
  let shielded = new Map<Element, { inert: string | null; ariaHidden: string | null }>()
  let redirecting = false
  let focusedRegion = getModalExemptRegions(doc).find((node) => contains(node, activeElement(doc)))
  let observer = new MutationObserver((records) => {
    // Changes inside unshielded layers, backdrops, and live regions cannot change which background
    // nodes are shielded, so they skip the full-document rescan.
    let focusScope = scopes.findLast((scope) => scope.options.modal)
    let unshielded: Element[] = getModalExemptRegions(doc)
    for (let scope of focusScope ? scopes.slice(scopes.indexOf(focusScope)) : []) {
      unshielded.push(...getDismissableLayerBranch(scope.node))
      let backdrop = scope.options.getBackdrop?.()
      if (backdrop) unshielded.push(backdrop)
    }
    if (
      records.some(
        (record) =>
          !unshielded.some((node) => contains(node, record.target)) &&
          !isInLiveRegion(record.target),
      )
    ) {
      updateBackground()
    }
    let active = activeElement(doc)
    let scope = scopes.findLast(
      (scope) =>
        scope.lastFocused &&
        !containsScope(scope, scope.lastFocused) &&
        (!active || active === doc.body || containsScope(scope, active)),
    )
    if (scope) focus(scope.node)
  })

  function containsScope(scope: FocusScope, target: Node | null) {
    return scopes
      .slice(scopes.indexOf(scope))
      .some((current) =>
        getDismissableLayerBranch(current.node).some((node) => contains(node, target)),
      )
  }

  function focusInside(scope: FocusScope) {
    let target = scope.lastFocused
    if (
      !target ||
      !containsScope(scope, target) ||
      !isFocusable(target, { getShadowRoot: true }) ||
      !focus(target)
    ) {
      focus(scope.node)
    }
  }

  function updateBackground() {
    let focusScope = scopes.findLast((scope) => scope.options.modal)
    let boundaries = getSurfaceBoundaries(doc)
    for (let boundary of boundaries) {
      boundary.update(
        !!focusScope && containsScope(focusScope, boundary.node),
        (guard, previous, direction) => {
          let scope = scopes.findLast((scope) => scope.options.modal)
          if (!scope) return
          let NodeConstructor = doc.defaultView?.Node ?? Node
          let backwards =
            direction !== undefined
              ? direction === -1
              : (guard === boundary.before) ===
                (previous instanceof NodeConstructor && contains(boundary.node, previous))
          let all = tabbable(doc.body, { getShadowRoot: true })
          let candidates = all.filter(
            (node) => !node.hasAttribute('data-rmx-focus-guard') && containsScope(scope, node),
          )
          let index = all.indexOf(guard)
          let next = all.slice(backwards ? 0 : index + 1, backwards ? index : undefined)
          if (backwards) next.reverse()
          let target =
            next.find((node) => candidates.includes(node)) ??
            (backwards ? candidates.at(-1) : candidates[0])
          focus(target ?? scope.node, { preventScroll: false })
        },
      )
    }
    let roots: (Element | ShadowRoot)[] = [doc.body]
    observer.disconnect()
    if (scopes.length > 0) {
      for (let root of roots) {
        observer.observe(root, { childList: true, subtree: true })
        for (let node of root.querySelectorAll('*')) {
          if (node.shadowRoot) roots.push(node.shadowRoot)
        }
      }
    }

    let liveRegions = roots.flatMap((root) => Array.from(root.querySelectorAll(liveRegionSelector)))

    function background(scope: FocusScope | undefined) {
      let nodes = new Set<Element>()
      if (!scope) return nodes
      let allowed = [...liveRegions, ...getModalExemptRegions(doc)]
      for (let boundary of getSurfaceBoundaries(doc)) {
        if (containsScope(scope, boundary.node)) allowed.push(boundary.before, boundary.after)
      }
      for (let current of scopes.slice(scopes.indexOf(scope))) {
        allowed.push(...getDismissableLayerBranch(current.node))
        let backdrop = current.options.getBackdrop?.()
        if (backdrop) allowed.push(backdrop)
      }

      function visit(parent: Element | ShadowRoot) {
        for (let child of parent.children) {
          if (allowed.includes(child)) continue
          if (allowed.some((node) => contains(child, node))) {
            visit(child)
            if (child.shadowRoot) visit(child.shadowRoot)
          } else {
            nodes.add(child)
          }
        }
      }

      visit(doc.body)
      return nodes
    }

    // A nonmodal child can relax its own boundary, but not an open ancestor's.
    let modalScope = scopes.findLast((scope) => scope.options.modal === true)
    let hidden = background(focusScope)
    let inert = modalScope === focusScope ? hidden : background(modalScope)
    let next = new Set([...hidden, ...inert])

    for (let [node, previous] of shielded) {
      if (next.has(node)) continue
      restoreAttribute(node, 'inert', previous.inert)
      restoreAttribute(node, 'aria-hidden', previous.ariaHidden)
      shielded.delete(node)
    }
    for (let node of next) {
      let previous = shielded.get(node)
      if (!previous) {
        previous = {
          inert: node.getAttribute('inert'),
          ariaHidden: node.getAttribute('aria-hidden'),
        }
        shielded.set(node, previous)
      }
      if (inert.has(node)) node.setAttribute('inert', '')
      else restoreAttribute(node, 'inert', previous.inert)
      node.setAttribute('aria-hidden', 'true')
    }
  }

  function onFocusIn(event: FocusEvent) {
    let scope = scopes.at(-1)
    if (!scope || redirecting) return
    let target = activeElement(doc)
    focusedRegion = getModalExemptRegions(doc).find((node) => contains(node, target))
    let interaction = focusedRegion !== undefined
    let focusScope = scopes.findLast((scope) => scope.options.modal)
    if (focusScope && !interaction && !containsScope(focusScope, target)) {
      redirecting = true
      focusInside(focusScope)
      focusScope.lastFocused = activeElement(doc)
      redirecting = false
      return
    }
    for (let current of scopes.slice(focusScope ? scopes.indexOf(focusScope) : 0)) {
      if (containsScope(current, target)) current.lastFocused = target
    }
    if (!containsScope(scope, target) && scope.options.modal === false) {
      scope.options.onFocusOutside?.(event)
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    let scope = scopes.findLast((scope) => scope.options.modal)
    if (
      !scope ||
      event.defaultPrevented ||
      event.key !== 'Tab' ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isInModalExemptRegion(doc, activeElement(doc))
    ) {
      return
    }
    let root = scopes
      .slice(scopes.indexOf(scope))
      .every((current) =>
        getDismissableLayerBranch(current.node).every((node) => contains(scope.node, node)),
      )
      ? scope.node
      : doc.body
    let candidates = tabbable(root, { getShadowRoot: true }).filter(
      (node) => !node.hasAttribute('data-rmx-focus-guard') && containsScope(scope, node),
    )
    // Only an empty scope needs Tab interception. Guards observe actual boundary crossings
    // without predicting which controls the browser includes in sequential navigation.
    if (candidates.length === 0) {
      event.preventDefault()
      focus(scope.node, { preventScroll: false })
    }
  }

  let stopObservingBoundaries = observeSurfaceBoundaries(doc, updateBackground)
  let stopObservingLayers = observeDismissableLayers(doc, updateBackground)
  let stopObservingRegions = observeModalExemptRegions(doc, (node, registered) => {
    updateBackground()
    let scope = scopes.findLast((scope) => scope.options.modal)
    let active = activeElement(doc)
    if (
      !registered &&
      scope &&
      (contains(node, active) || (focusedRegion === node && active === doc.body)) &&
      !containsScope(scope, active) &&
      !isInModalExemptRegion(doc, active)
    ) {
      focusInside(scope)
    }
  })
  doc.addEventListener('focusin', onFocusIn)
  doc.addEventListener('keydown', onKeyDown)

  return {
    add(scope: FocusScope) {
      scope.previous = scopes.at(-1)
      scopes.push(scope)
      updateBackground()
    },
    update(scope: FocusScope, modal: FocusScopeOptions['modal']) {
      if (modal) validateBoundaries(scope.node)
      scope.options.modal = modal
      updateBackground()
      let focusScope = scopes.findLast((scope) => scope.options.modal)
      if (
        focusScope &&
        !containsScope(focusScope, activeElement(doc)) &&
        !isInModalExemptRegion(doc, activeElement(doc))
      )
        focusInside(focusScope)
    },
    restoreFocus(target: Element | false | null) {
      if (target === false) return
      if (target && isFocusable(target, { getShadowRoot: true }) && focus(target)) return
      let scope = scopes.findLast((scope) => scope.options.modal)
      if (scope) focusInside(scope)
    },
    remove(scope: FocusScope) {
      let wasCurrent = scopes.at(-1) === scope
      scopes.splice(scopes.indexOf(scope), 1)
      updateBackground()
      if (scopes.length === 0) {
        stopObservingBoundaries()
        stopObservingLayers()
        stopObservingRegions()
        doc.removeEventListener('focusin', onFocusIn)
        doc.removeEventListener('keydown', onKeyDown)
        managers.delete(doc)
      }
      return wasCurrent
    },
  }
}

function validateBoundaries(node: HTMLElement): void {
  let boundaries = getSurfaceBoundaries(node.ownerDocument)
  for (let child of getDismissableLayerBranch(node)) {
    if (!contains(node, child) && !boundaries.some((boundary) => boundary.node === child))
      throw new Error(
        'Detached popups in a modal require PopoverContext or popover.SurfaceContext at their DOM destination',
      )
  }
}

function isInLiveRegion(node: Node | null): boolean {
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).closest(liveRegionSelector)) {
      return true
    }
    let root = node.getRootNode()
    node =
      root.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? ((root as ShadowRoot).host ?? null) : null
  }
  return false
}

function focus(
  node: Element | null | false,
  options: FocusOptions = { preventScroll: true },
): boolean {
  if (!node || !node.isConnected || !('focus' in node) || typeof node.focus !== 'function')
    return false
  node.focus(options)
  return contains(node, activeElement(node.ownerDocument))
}

function restoreAttribute(node: Element, name: string, value: string | null): void {
  if (value === null) node.removeAttribute(name)
  else node.setAttribute(name, value)
}
