import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { registerDismissableLayer } from './dismissable-layer.ts'

let layers: ReturnType<typeof registerDismissableLayer>[] = []

function register(
  options: Parameters<typeof registerDismissableLayer>[1],
  parent: HTMLElement = document.body,
) {
  let node = parent.ownerDocument.createElement('div')
  parent.append(node)
  let layer = registerDismissableLayer(node, options)
  layers.push(layer)
  return { node, ...layer }
}

function escape(target: EventTarget, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Escape',
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

function click(target: HTMLElement) {
  let event = new MouseEvent('click', { bubbles: true, composed: true, button: 0 })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  for (let layer of layers) {
    layer.dispose()
  }
  layers = []
  document.body.innerHTML = ''
})

describe('registerDismissableLayer', () => {
  it('keeps a late-registering parent below its already open child', () => {
    let dismissed: string[] = []
    let parentNode = document.createElement('div')
    let trigger = document.createElement('button')
    parentNode.append(trigger)
    document.body.append(parentNode)
    let child = register({ getParent: () => trigger, onDismiss: () => dismissed.push('child') })
    let parent = registerDismissableLayer(parentNode, { onDismiss: () => dismissed.push('parent') })
    layers.push(parent)
    expect(child.isTop()).toBe(true)
    escape(document.body)
    expect(dismissed).toEqual(['child'])
  })

  it('dismisses sibling layers in reverse opening order with one Escape per layer', () => {
    let dismissed: string[] = []
    let first = register({ onDismiss: () => dismissed.push('first') })
    let second = register({ onDismiss: () => dismissed.push('second') })

    expect(first.isTop()).toBe(false)
    expect(second.isTop()).toBe(true)
    expect(escape(first.node).defaultPrevented).toBe(true)
    expect(dismissed).toEqual(['second'])

    second.dispose()
    expect(first.isTop()).toBe(true)
    escape(document.body)
    expect(dismissed).toEqual(['second', 'first'])
  })

  it('dismisses only the top layer when its callback removes it immediately', () => {
    let dismissed: string[] = []
    register({ onDismiss: () => dismissed.push('first') })
    let second = register({
      onDismiss() {
        dismissed.push('second')
        second.dispose()
      },
    })

    click(document.body)
    expect(dismissed).toEqual(['second'])
  })

  it('does not dismiss a parent while Escape is still held after closing a child', () => {
    let dismissed: string[] = []
    let parent = register({ onDismiss: () => dismissed.push('parent') })
    let child = register(
      {
        onDismiss() {
          dismissed.push('child')
          child.dispose()
        },
      },
      parent.node,
    )

    escape(child.node)
    escape(parent.node, { repeat: true })
    expect(dismissed).toEqual(['child'])
    escape(parent.node)
    expect(dismissed).toEqual(['child', 'parent'])
  })

  it('passes the original event and target to dismissal callbacks', () => {
    let requests: Array<
      Parameters<Parameters<typeof registerDismissableLayer>[1]['onDismiss']>[0]
    > = []
    register({ onDismiss: (request) => requests.push(request) })

    let event = click(document.body)
    expect(requests).toEqual([{ reason: 'outside-click', event, target: document.body }])
  })

  it('blocks dismissal of lower layers when the top layer disables dismissal', () => {
    let dismissed: string[] = []
    let enabled = false
    register({ onDismiss: () => dismissed.push('first') })
    register({
      onDismiss: () => dismissed.push('second'),
      dismissOnEscape: () => enabled,
      dismissOnOutsideClick: () => enabled,
    })

    expect(escape(document.body).defaultPrevented).toBe(false)
    click(document.body)
    expect(dismissed).toEqual([])

    enabled = true
    escape(document.body)
    click(document.body)
    expect(dismissed).toEqual(['second', 'second'])
  })

  it('lets descendants handle Escape first and ignores composition Escape', () => {
    let dismissed: string[] = []
    let { node } = register({ onDismiss: () => dismissed.push('layer') })

    node.addEventListener('keydown', (event) => event.preventDefault(), { once: true })
    escape(node)
    expect(escape(node, { isComposing: true }).defaultPrevented).toBe(false)
    expect(escape(node, { keyCode: 229 }).defaultPrevented).toBe(false)
    expect(dismissed).toEqual([])

    escape(node)
    expect(dismissed).toEqual(['layer'])
  })

  it('stops outside click propagation by default and can allow the target click', () => {
    let clicked = 0
    let dismissed = 0
    let stopPropagation = true
    let outside = document.createElement('button')
    document.body.append(outside)
    outside.addEventListener('click', () => clicked++)
    register({
      onDismiss: () => dismissed++,
      stopOutsideClickPropagation: () => stopPropagation,
    })

    click(outside)
    expect(clicked).toBe(0)
    expect(dismissed).toBe(1)

    stopPropagation = false
    click(outside)
    expect(clicked).toBe(1)
    expect(dismissed).toBe(2)
  })

  it('treats extra inside targets and shadow descendants as inside the layer', () => {
    let dismissed = 0
    let anchor = document.createElement('button')
    document.body.append(anchor)
    let { node } = register({
      onDismiss: () => dismissed++,
      isInside: (target) => anchor.contains(target),
    })
    let host = document.createElement('div')
    document.body.append(host)
    let shadow = host.attachShadow({ mode: 'open' })
    shadow.append(node)

    click(node)
    click(anchor)
    expect(dismissed).toBe(0)

    click(document.body)
    expect(dismissed).toBe(1)
  })

  it('does not dismiss after dragging from inside to outside', () => {
    let dismissed = 0
    let { node } = register({ onDismiss: () => dismissed++ })

    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    click(document.body)
    expect(dismissed).toBe(0)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    click(document.body)
    expect(dismissed).toBe(1)
  })

  it('does not dismiss a layer opened during the current pointer gesture', () => {
    let dismissed: string[] = []
    let first = register({ onDismiss: () => dismissed.push('first') })
    first.node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    register({ onDismiss: () => dismissed.push('second') })

    first.node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    click(first.node)
    expect(dismissed).toEqual([])

    click(first.node)
    expect(dismissed).toEqual(['second'])
  })

  it('does not dismiss the first layer opened after pointerdown', () => {
    let dismissed = 0
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    register({ onDismiss: () => dismissed++ })
    document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    click(document.body)
    expect(dismissed).toBe(0)

    click(document.body)
    expect(dismissed).toBe(1)
  })

  it('does not dismiss a lower layer when the top layer closes during a pointer gesture', () => {
    let dismissed: string[] = []
    register({ onDismiss: () => dismissed.push('first') })
    let second = register({ onDismiss: () => dismissed.push('second') })
    second.node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    second.dispose()

    click(document.body)
    expect(dismissed).toEqual([])
  })

  it('clears canceled gestures so later click-only activation can dismiss', () => {
    let dismissed = 0
    let { node } = register({ onDismiss: () => dismissed++ })
    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    node.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }))

    click(document.body)
    expect(dismissed).toBe(1)
  })

  it('keeps layers in separate documents independent', () => {
    let dismissed: string[] = []
    let otherDocument = document.implementation.createHTMLDocument()
    let first = register({ onDismiss: () => dismissed.push('first') })
    let second = register({ onDismiss: () => dismissed.push('second') }, otherDocument.body)

    expect(first.isTop()).toBe(true)
    expect(second.isTop()).toBe(true)
    escape(document.body)
    expect(dismissed).toEqual(['first'])
    escape(otherDocument.body)
    expect(dismissed).toEqual(['first', 'second'])
  })

  it('disposes out of order and allows a new stack after the last layer is removed', () => {
    let dismissed: string[] = []
    let first = register({ onDismiss: () => dismissed.push('first') })
    let second = register({ onDismiss: () => dismissed.push('second') })
    first.dispose()
    first.dispose()
    expect(first.isTop()).toBe(false)
    expect(second.isTop()).toBe(true)
    second.dispose()
    expect(escape(document.body).defaultPrevented).toBe(false)
    click(document.body)
    expect(dismissed).toEqual([])

    let third = register({ onDismiss: () => dismissed.push('third') })
    expect(third.isTop()).toBe(true)
    escape(document.body)
    expect(dismissed).toEqual(['third'])
  })

  it('closes contained descendants once while preserving unrelated layers', () => {
    let closed: string[] = []
    let dismissed: string[] = []
    let parent = register({ onDismiss() {} })
    let child = register({ onDismiss() {}, onParentClose: () => closed.push('child') }, parent.node)
    let grandchild = register(
      { onDismiss() {}, onParentClose: () => closed.push('grandchild') },
      child.node,
    )
    let sibling = register({ onDismiss: () => dismissed.push('sibling') })

    parent.dispose()
    parent.dispose()
    expect(closed).toEqual(['grandchild', 'child'])
    expect(child.isTop()).toBe(false)
    expect(grandchild.isTop()).toBe(false)
    expect(sibling.isTop()).toBe(true)
    escape(document.body)
    expect(dismissed).toEqual(['sibling'])
  })

  it('closes detached descendants through their owning trigger', () => {
    let closed: string[] = []
    let parent = register({ onDismiss() {} })
    let child = register({
      getParent: () => parent.node,
      onDismiss() {},
      onParentClose: () => closed.push('child'),
    })
    let grandchild = register({
      getParent: () => child.node,
      onDismiss() {},
      onParentClose: () => closed.push('grandchild'),
    })
    let sibling = register({ onDismiss() {} })

    parent.dispose()
    expect(closed).toEqual(['grandchild', 'child'])
    expect(child.isTop()).toBe(false)
    expect(grandchild.isTop()).toBe(false)
    expect(sibling.isTop()).toBe(true)
  })

  it('adopts a detached popup when its nearer owner registers after it', () => {
    let closed = 0
    let root = register({ onDismiss() {} })
    let intermediate = document.createElement('div')
    root.node.append(intermediate)
    let trigger = document.createElement('button')
    intermediate.append(trigger)
    let child = register({
      getParent: () => trigger,
      onDismiss() {},
      onParentClose: () => closed++,
    })
    let parent = registerDismissableLayer(intermediate, { onDismiss() {} })
    layers.push(parent)
    parent.dispose()
    expect(closed).toBe(1)
    expect(child.isTop()).toBe(false)
    expect(root.isTop()).toBe(true)
  })

  it('retains detached popup ownership when its trigger is removed', () => {
    let closed = 0
    let parent = register({ onDismiss() {} })
    let trigger = document.createElement('button')
    parent.node.append(trigger)
    let child = register({
      getParent: () => trigger,
      onDismiss() {},
      onParentClose: () => closed++,
    })

    trigger.remove()
    parent.dispose()
    expect(closed).toBe(1)
    expect(child.isTop()).toBe(false)
  })

  it('releases popups owned by a trigger inside a shadow root', () => {
    let closed = 0
    let parent = register({ onDismiss() {} })
    let host = document.createElement('div')
    parent.node.append(host)
    let trigger = document.createElement('button')
    host.attachShadow({ mode: 'open' }).append(trigger)
    let child = register({
      getParent: () => trigger,
      onDismiss() {},
      onParentClose: () => closed++,
    })

    parent.dispose()
    expect(closed).toBe(1)
    expect(child.isTop()).toBe(false)
  })

  it('cleans descendants registered before their ancestor and without a close callback', () => {
    let parent = document.createElement('div')
    document.body.append(parent)
    let child = register({ onDismiss() {} }, parent)
    let parentLayer = registerDismissableLayer(parent, { onDismiss() {} })
    layers.push(parentLayer)

    parentLayer.dispose()
    expect(child.isTop()).toBe(false)
    expect(escape(document.body).defaultPrevented).toBe(false)
  })

  it('handles reentrant disposal and opening a new layer from descendant close callbacks', () => {
    let closed: string[] = []
    let dismissed: string[] = []
    let parent = register({ onDismiss() {} })
    let child = register(
      {
        onDismiss() {},
        onParentClose() {
          closed.push('child')
          parent.dispose()
          register({ onDismiss: () => dismissed.push('replacement') })
        },
      },
      parent.node,
    )
    register(
      {
        onDismiss() {},
        onParentClose() {
          closed.push('grandchild')
          child.dispose()
        },
      },
      child.node,
    )

    parent.dispose()
    expect(closed).toEqual(['grandchild', 'child'])
    escape(document.body)
    expect(dismissed).toEqual(['replacement'])
  })

  it('cleans nested layers when their ancestor has already been removed', () => {
    let closed = 0
    let parent = register({ onDismiss() {} })
    let child = register({ onDismiss() {}, onParentClose: () => closed++ }, parent.node)

    parent.node.remove()
    parent.dispose()
    child.dispose()
    expect(closed).toBe(1)
    expect(escape(document.body).defaultPrevented).toBe(false)
  })
})
