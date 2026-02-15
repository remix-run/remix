import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { connect } from './connect.ts'
import { presence } from './presence.ts'

describe('plugin-spike connect plugin', () => {
  it('does not connect when initial connect prop is missing', () => {
    let calls = 0
    let reconciler = createReconciler([connect])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => <div key="a">hello</div>)
    root.flush()

    root.render(() => (
      <div
        key="a"
        connect={() => {
          calls++
        }}
      >
        hello
      </div>
    ))
    root.flush()

    expect(calls).toBe(0)
  })

  it('calls connect on mount and aborts signal on remove', () => {
    let calls = 0
    let capturedSignal: null | AbortSignal = null

    let reconciler = createReconciler([connect])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div
        key="a"
        connect={(_node, signal) => {
          calls++
          capturedSignal = signal
        }}
      >
        hello
      </div>
    ))
    root.flush()
    expect(calls).toBe(1)
    expect(capturedSignal?.aborted).toBe(false)

    root.render(() => (
      <div
        key="a"
        id="updated"
        connect={() => {
          calls++
        }}
      >
        hello
      </div>
    ))
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

    let reconciler = createReconciler([connect, presence])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div
        key="a"
        {...({ presenceMs: 50 } as Record<string, unknown>)}
        connect={(node, signal) => {
          firstNode = node
          firstSignal = signal
        }}
      >
        hello
      </div>
    ))
    root.flush()
    expect(firstSignal?.aborted).toBe(false)

    root.render(() => null)
    root.flush()
    expect(firstSignal?.aborted).toBe(true)

    root.render(() => (
      <div
        key="a"
        {...({ presenceMs: 50 } as Record<string, unknown>)}
        connect={(node, signal) => {
          secondNode = node
          secondSignal = signal
        }}
      >
        hello again
      </div>
    ))
    root.flush()

    expect(secondNode).toBe(firstNode)
    expect(secondSignal).toBeTruthy()
    expect(secondSignal).not.toBe(firstSignal)
    expect(secondSignal?.aborted).toBe(false)
  })
})
