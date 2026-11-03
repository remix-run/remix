import { contains } from './contains.ts'

type DismissableLayerOptions = {
  getParent?(): Node | null
  getBackdrop?(): HTMLElement | null
  onDismiss(request: {
    reason: 'escape-key' | 'outside-click'
    event: KeyboardEvent | MouseEvent
    target: Node | null
  }): void
  onParentClose?(): void
  isInside?(target: Node): boolean
  dismissOnEscape?(): boolean
  dismissOnOutsideClick?(): boolean
  stopOutsideClickPropagation?(): boolean
}

type DismissableLayer = {
  node: HTMLElement
  options: DismissableLayerOptions
  parent: DismissableLayer | undefined
  styles: Map<HTMLElement, string>
}

const documents = new WeakMap<Document, ReturnType<typeof createDocumentLayers>>()
const observers = new WeakMap<Document, Set<() => void>>()

export function getDismissableLayerBranch(node: HTMLElement): HTMLElement[] {
  let branch = new Set([node])
  let layers = documents.get(node.ownerDocument)?.layers ?? []
  let previousSize: number
  do {
    previousSize = branch.size
    for (let layer of layers) {
      if (
        (layer.parent && branch.has(layer.parent.node)) ||
        [...branch].some((owner) => contains(owner, layer.node))
      ) {
        branch.add(layer.node)
      }
    }
  } while (branch.size !== previousSize)
  return [...branch]
}

export function observeDismissableLayers(document: Document, callback: () => void): () => void {
  let callbacks = observers.get(document)
  if (!callbacks) {
    callbacks = new Set()
    observers.set(document, callbacks)
  }
  callbacks.add(callback)
  return () => {
    callbacks.delete(callback)
    if (callbacks.size === 0) observers.delete(document)
  }
}

function updateLayerOrder(layers: DismissableLayer[]) {
  for (let [index, layer] of layers.entries()) {
    let backdrop = layer.options.getBackdrop?.()
    for (let [node, previous] of layer.styles) {
      if (node === layer.node || node === backdrop) continue
      restoreOrder(node, previous)
      layer.styles.delete(node)
    }
    for (let node of backdrop ? [backdrop, layer.node] : [layer.node]) {
      if (!layer.styles.has(node)) {
        layer.styles.set(node, node.style.getPropertyValue('--rmx-layer-order'))
      }
      node.style.setProperty('--rmx-layer-order', String(index * 2 + (node === backdrop ? 1 : 2)))
    }
  }
}

function restoreOrder(node: HTMLElement, previous: string) {
  if (previous) node.style.setProperty('--rmx-layer-order', previous)
  else node.style.removeProperty('--rmx-layer-order')
}

function notifyObservers(document: Document) {
  for (let callback of observers.get(document) ?? []) callback()
}

function eventNodes(event: Event, document: Document): Node[] {
  let NodeConstructor = document.defaultView?.Node ?? Node
  return event.composedPath().filter((target): target is Node => target instanceof NodeConstructor)
}

function isInside(layer: DismissableLayer, event: Event): boolean {
  let branch = getDismissableLayerBranch(layer.node)
  return eventNodes(event, layer.node.ownerDocument).some(
    (target) => branch.some((node) => contains(node, target)) || layer.options.isInside?.(target),
  )
}

function createDocumentLayers(document: Document) {
  let layers: DismissableLayer[] = []
  let pointerOrigin: { layer: DismissableLayer | undefined; inside: boolean } | undefined
  let pointerReset: ReturnType<typeof setTimeout> | undefined

  function clearPointerOrigin() {
    clearTimeout(pointerReset)
    pointerReset = undefined
    pointerOrigin = undefined
  }

  function onPointerDown(event: PointerEvent) {
    clearPointerOrigin()
    let layer = layers.at(-1)
    if (layer) {
      pointerOrigin = { layer, inside: isInside(layer, event) }
    }
  }

  function onPointerUp() {
    // The first layer may have opened after this gesture's pointerdown was dispatched.
    pointerOrigin ??= { layer: undefined, inside: false }
    // A click follows pointerup in the same turn. Clear gestures that produce no click.
    pointerReset = setTimeout(clearPointerOrigin, 0)
  }

  function onClick(event: MouseEvent) {
    let origin = pointerOrigin
    clearPointerOrigin()
    let layer = layers.at(-1)
    if (
      !layer ||
      event.button !== 0 ||
      (origin && (origin.layer !== layer || origin.inside)) ||
      isInside(layer, event) ||
      layer.options.dismissOnOutsideClick?.() === false
    ) {
      return
    }

    if (layer.options.stopOutsideClickPropagation?.() !== false) {
      event.stopPropagation()
    }
    layer.options.onDismiss({
      reason: 'outside-click',
      event,
      target: eventNodes(event, document)[0] ?? null,
    })
  }

  function onKeyDown(event: KeyboardEvent) {
    let layer = layers.at(-1)
    if (
      !layer ||
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.keyCode === 229 ||
      layer.options.dismissOnEscape?.() === false
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    layer.options.onDismiss({
      reason: 'escape-key',
      event,
      target: eventNodes(event, document)[0] ?? null,
    })
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', clearPointerOrigin, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown)

  return {
    layers,
    dispose() {
      clearPointerOrigin()
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', clearPointerOrigin, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown)
    },
  }
}

export function registerDismissableLayer(
  node: HTMLElement,
  options: DismissableLayerOptions,
): { isTop(): boolean; update(): void; dispose(): void } {
  let document = node.ownerDocument
  let state = documents.get(document)
  if (!state) {
    state = createDocumentLayers(document)
    documents.set(document, state)
  }

  let { layers, dispose } = state
  let layer: DismissableLayer = { node, options, parent: undefined, styles: new Map() }
  layers.push(layer)
  // Keep the owner for the open session even if its trigger is removed or replaced.
  // A later registration can also establish the owner of an already-mounted child.
  for (let child of layers) {
    let target = child.options.getParent?.() ?? child.node
    let parent: DismissableLayer | undefined
    for (let candidate of layers) {
      if (candidate === child || !contains(candidate.node, target)) continue
      if (parent && !contains(parent.node, candidate.node)) continue
      let ancestor: DismissableLayer | undefined = candidate
      while (ancestor && ancestor !== child) ancestor = ancestor.parent
      if (!ancestor) parent = candidate
    }
    child.parent = parent ?? child.parent
  }
  // An initially open child can register before its parent finishes mounting.
  // Keep keyboard priority and paint order consistent with their ownership.
  for (let index = 0; index < layers.length; index++) {
    let parent = layers[index].parent
    if (parent && layers.indexOf(parent) > index) {
      layers.splice(layers.indexOf(parent), 1)
      layers.splice(index, 0, parent)
      index = -1
    }
  }
  updateLayerOrder(layers)
  notifyObservers(document)

  return {
    isTop: () => layers.at(-1) === layer,
    update: () => updateLayerOrder(layers),
    dispose() {
      if (!layers.includes(layer)) {
        return
      }

      // Remove the branch before callbacks can dispose layers or open replacements.
      let branch = new Set(getDismissableLayerBranch(node))
      let descendants: DismissableLayer[] = []
      for (let index = layers.length - 1; index >= 0; index--) {
        let current = layers[index]
        if (branch.has(current.node)) {
          layers.splice(index, 1)
          for (let [node, previous] of current.styles) restoreOrder(node, previous)
          current.styles.clear()
          if (current !== layer) {
            descendants.push(current)
          }
        }
      }
      if (layers.length === 0) {
        dispose()
        documents.delete(document)
      }
      updateLayerOrder(layers)
      notifyObservers(document)
      for (let descendant of descendants) {
        descendant.options.onParentClose?.()
      }
    },
  }
}
