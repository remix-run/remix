import { describe, expect, it } from 'vitest'

import { createReconciler } from './index.ts'
import type { Plugin } from './types.ts'

describe('plugin-spike reconciler', () => {
  it('mounts, updates, and removes host nodes', () => {
    let reconciler = createReconciler([createPassthroughPlugin()])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <section key="root" id="a" connect={() => {}}>
        first
      </section>
    ))
    root.flush()
    expect(container.innerHTML).toBe('<section>first</section>')

    root.render(() => (
      <section key="root" id="b" connect={() => {}}>
        second
      </section>
    ))
    root.flush()
    expect(container.innerHTML).toBe('<section>second</section>')

    root.render(() => null)
    root.flush()
    expect(container.innerHTML).toBe('')
  })

  it('does not apply host props without plugins', () => {
    let reconciler = createReconciler([createPassthroughPlugin()])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div key="root" {...({ customState: 'first', connect() {} } as Record<string, unknown>)}>
        hello
      </div>
    ))
    root.flush()

    let node = container.firstElementChild as HTMLDivElement
    expect(container.innerHTML).toBe('<div>hello</div>')
    expect(node.getAttribute('customState')).toBeNull()
  })
})

function createPassthroughPlugin(): Plugin {
  return () => () => (input) => input
}
