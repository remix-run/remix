import { isFocusable, tabbable } from 'tabbable'
import { contains } from '../lib/contains.ts'
import { getDismissableLayerBranch, observeDismissableLayers } from '../lib/dismissable-layer.ts'

type FocusScopeOptions = {
  modal: boolean | 'trap-focus'
  initialFocus?: HTMLElement | false | null
  returnFocus?: HTMLElement | false | null | (() => HTMLElement | false | null)
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
  dispose(options?: { restoreFocus?: boolean }): void
} {
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
    dispose({ restoreFocus = true } = {}) {
      if (scope.disposed) return
      scope.disposed = true
      let returnTarget = restoreFocus ? scope.getReturnTarget() : false
      scope.getReturnTarget = () => returnTarget
      let wasCurrent = manager.remove(scope)
      if (wasCurrent && restoreFocus) {
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
        manager.restoreFocus(target)
      }
    },
  }
}

function createManager(doc: Document) {
  let scopes: FocusScope[] = []
  let shielded = new Map<Element, { inert: string | null; ariaHidden: string | null }>()
  let redirecting = false
  let observer = new MutationObserver(() => {
    updateBackground()
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

    let liveRegions = roots.flatMap((root) =>
      Array.from(
        root.querySelectorAll(
          '[aria-live]:not([aria-live="off"]), [role="alert"], [role="status"], [role="log"]',
        ),
      ),
    )

    function background(scope: FocusScope | undefined) {
      let nodes = new Set<Element>()
      if (!scope) return nodes
      let allowed = [...liveRegions]
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
    let focusScope = scopes.findLast((scope) => scope.options.modal)
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
    let focusScope = scopes.findLast((scope) => scope.options.modal)
    if (focusScope && !containsScope(focusScope, target)) {
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
      event.metaKey
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
    let allCandidates = tabbable(root, { getShadowRoot: true })
    let candidates = allCandidates.filter((node) => containsScope(scope, node))
    let active = activeElement(doc)
    let index = candidates.findIndex((node) => node === active)
    let direction = event.shiftKey ? -1 : 1
    let target =
      candidates[index + direction] ??
      (event.shiftKey ? candidates.at(-1) : candidates[0]) ??
      scope.node
    let next = allCandidates[allCandidates.findIndex((node) => node === active) + direction]
    if (index === -1 || next !== target) {
      event.preventDefault()
      focus(target, { preventScroll: false })
    }
  }

  let stopObservingLayers = observeDismissableLayers(doc, updateBackground)
  doc.addEventListener('focusin', onFocusIn)
  doc.addEventListener('keydown', onKeyDown)

  return {
    add(scope: FocusScope) {
      scope.previous = scopes.at(-1)
      scopes.push(scope)
      updateBackground()
    },
    update(scope: FocusScope, modal: FocusScopeOptions['modal']) {
      scope.options.modal = modal
      updateBackground()
      let focusScope = scopes.findLast((scope) => scope.options.modal)
      if (focusScope && !containsScope(focusScope, activeElement(doc))) focusInside(focusScope)
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
        stopObservingLayers()
        doc.removeEventListener('focusin', onFocusIn)
        doc.removeEventListener('keydown', onKeyDown)
        managers.delete(doc)
      }
      return wasCurrent
    },
  }
}

function activeElement(doc: Document): Element | null {
  let active = doc.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
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
