import { describe, expect, it } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { connect } from './connect-mixin.tsx'

describe('connect mixin', () => {
  it('calls callback once for the connected node', () => {
    let calls = 0
    let connectedNode: null | HTMLButtonElement = null
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          connect((node) => {
            calls++
            connectedNode = node
          }),
        ]}
      >
        hello
      </button>,
    )
    root.flush()

    root.render(
      <button
        mix={[
          connect(() => {
            calls++
          }),
        ]}
      >
        hello
      </button>,
    )
    root.flush()

    expect(calls).toBe(1)
    expect(connectedNode).toBe(container.firstElementChild)
  })

  it('aborts signal when connected node is removed', () => {
    let connectedSignal: AbortSignal | undefined
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          connect((_node, signal) => {
            connectedSignal = signal
          }),
        ]}
      >
        hello
      </button>,
    )
    root.flush()

    if (!connectedSignal) throw new Error('expected signal')
    expect(connectedSignal.aborted).toBe(false)

    root.render(null)
    root.flush()
    expect(connectedSignal.aborted).toBe(true)
  })
})
