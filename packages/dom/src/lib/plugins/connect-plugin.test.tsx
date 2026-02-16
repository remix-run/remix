import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'

import { createDomNodePolicy } from '../dom-node-policy.ts'
import { connectPlugin } from './connect-plugin.ts'

describe('connectPlugin', () => {
  it('connects on mount and aborts on remove', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)
    let connectedNode: null | Element = null
    let aborted = false

    root.render(
      <div
        connect={(node, signal) => {
          connectedNode = node
          signal.addEventListener('abort', () => {
            aborted = true
          })
        }}
      />,
    )
    root.flush()

    expect(connectedNode).toBeInstanceOf(HTMLDivElement)
    expect(aborted).toBe(false)

    root.render(null)
    root.flush()

    expect(aborted).toBe(true)
  })

  it('does not reconnect on updates', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)
    let calls = 0

    root.render(
      <div
        connect={() => {
          calls++
        }}
      >
        first
      </div>,
    )
    root.flush()

    root.render(
      <div
        id="next"
        connect={() => {
          calls++
        }}
      >
        second
      </div>,
    )
    root.flush()

    expect(calls).toBe(1)
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), [connectPlugin])
  return reconciler.createRoot(container)
}
