import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { waitForCssTransition } from './wait-for-css-transition.ts'

function createNode() {
  let node = document.createElement('div')
  document.body.append(node)

  return node
}

let animationFrameCallbacks: FrameRequestCallback[] = []

function flushAnimationFrame() {
  let callbacks = animationFrameCallbacks
  animationFrameCallbacks = []

  for (let callback of callbacks) {
    callback(performance.now())
  }
}

beforeEach(() => {
  animationFrameCallbacks = []

  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })

  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('waitForCssTransition', () => {
  it('resolves after the detection window when no transition runs', async () => {
    let node = createNode()
    let resolved = false
    let promise = waitForCssTransition(node, new AbortController().signal, () => {
      node.dataset.state = 'open'
    }).then(() => {
      resolved = true
    })

    await Promise.resolve()

    expect(resolved).toBe(false)

    flushAnimationFrame()
    await Promise.resolve()

    expect(resolved).toBe(false)

    flushAnimationFrame()
    await promise

    expect(resolved).toBe(true)
  })

  it('waits for transitionend after transitionrun is observed', async () => {
    let node = createNode()
    let resolved = false
    let promise = waitForCssTransition(node, new AbortController().signal, () => {
      node.dataset.state = 'open'
    }).then(() => {
      resolved = true
    })

    await Promise.resolve()
    flushAnimationFrame()
    node.dispatchEvent(new TransitionEvent('transitionrun', { propertyName: 'opacity' }))
    flushAnimationFrame()
    await Promise.resolve()

    expect(resolved).toBe(false)
    node.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }))
    await promise

    expect(resolved).toBe(true)
  })

  it('ignores delayed transitions that start after the detection window', async () => {
    let node = createNode()
    let resolved = false
    let promise = waitForCssTransition(node, new AbortController().signal, () => {
      node.dataset.state = 'open'
    }).then(() => {
      resolved = true
    })

    flushAnimationFrame()
    flushAnimationFrame()
    await promise

    expect(resolved).toBe(true)

    node.dispatchEvent(new TransitionEvent('transitionrun', { propertyName: 'opacity' }))
  })

  it('resolves when the abort signal fires before transitionend', async () => {
    let node = createNode()
    let controller = new AbortController()
    let resolved = false
    let promise = waitForCssTransition(node, controller.signal, () => {
      node.dataset.state = 'open'
    }).then(() => {
      resolved = true
    })

    await Promise.resolve()
    flushAnimationFrame()

    expect(resolved).toBe(false)

    controller.abort()
    await promise

    expect(resolved).toBe(true)
  })
})
