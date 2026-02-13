import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { presence } from './presence.ts'

describe('plugin-spike connect plugin', () => {
  it('does not connect when initial connect prop is missing', () => {
    let calls = 0
    let reconciler = createReconciler([])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'a',
        props: {},
        children: ['hello'],
      }),
    )
    root.flush()

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'a',
        props: {
          connect() {
            calls++
          },
        },
        children: ['hello'],
      }),
    )
    root.flush()

    expect(calls).toBe(0)
  })

  it('calls connect on mount and aborts signal on remove', () => {
    let calls = 0
    let capturedSignal: null | AbortSignal = null

    let reconciler = createReconciler([])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'a',
        props: {
          connect(_node, signal) {
            calls++
            capturedSignal = signal
          },
        },
        children: ['hello'],
      }),
    )
    root.flush()
    expect(calls).toBe(1)
    expect(capturedSignal?.aborted).toBe(false)

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'a',
        props: {
          id: 'updated',
          connect() {
            calls++
          },
        },
        children: ['hello'],
      }),
    )
    root.flush()
    expect(calls).toBe(1)
    expect(capturedSignal?.aborted).toBe(false)

    root.render(() => null)
    root.flush()
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('reconnects with a new signal when an exiting node is reclaimed', () => {
    let firstSignal: null | AbortSignal = null
    let secondSignal: null | AbortSignal = null
    let firstNode: null | Element = null
    let secondNode: null | Element = null

    let reconciler = createReconciler([presence])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'a',
        props: {
          presenceMs: 50,
          connect(node, signal) {
            firstNode = node
            firstSignal = signal
          },
        },
        children: ['hello'],
      }),
    )
    root.flush()
    expect(firstSignal?.aborted).toBe(false)

    root.render(() => null)
    root.flush()
    expect(firstSignal?.aborted).toBe(true)

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'a',
        props: {
          presenceMs: 50,
          connect(node, signal) {
            secondNode = node
            secondSignal = signal
          },
        },
        children: ['hello again'],
      }),
    )
    root.flush()

    expect(secondNode).toBe(firstNode)
    expect(secondSignal).toBeTruthy()
    expect(secondSignal).not.toBe(firstSignal)
    expect(secondSignal?.aborted).toBe(false)
  })
})
