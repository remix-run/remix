import { describe, it, expect } from 'vitest'
import { createRoot } from '../vdom.ts'
import { invariant } from '../invariant.ts'
import { ref } from './ref-mixin.tsx'
import type { Assert, Equal } from '../../test/utils.ts'

describe('ref mixin', () => {
  it('passes the bound node and handle signal to the callback', () => {
    let receivedNode: Element | null = null
    let state: { signal?: AbortSignal } = {}
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          ref((node, signal) => {
            receivedNode = node
            state.signal = signal
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    expect(receivedNode).toBe(button)
    let signal =
      state.signal ??
      (() => {
        throw new Error('expected ref callback to receive signal')
      })()
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal.aborted).toBe(false)
  })

  it('aborts the signal when the host node is removed', () => {
    let state: { signal?: AbortSignal } = {}
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div
        mix={[
          ref((_node, signal) => {
            state.signal = signal
          }),
        ]}
      />,
    )
    root.flush()
    let signal =
      state.signal ??
      (() => {
        throw new Error('expected ref callback to receive signal')
      })()
    expect(signal.aborted).toBe(false)

    root.render(null)
    root.flush()
    expect(signal.aborted).toBe(true)
  })
})

let infersNodeType = (
  <button
    mix={[
      ref((node, signal) => {
        type inferredNode = Assert<Equal<typeof node, HTMLButtonElement>>
        type inferredSignal = Assert<Equal<typeof signal, AbortSignal>>
      }),
    ]}
  />
)
