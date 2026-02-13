import { describe, expect, it } from 'vitest'

import { createReconciler } from './index.ts'
import type { HostInput, Plugin } from './types.ts'

describe('plugin-spike reconciler', () => {
  it('mounts, updates, and removes host nodes', () => {
    let reconciler = createReconciler([createPassthroughPlugin()])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'section',
        key: 'root',
        props: { id: 'a', connect() {} },
        children: ['first'],
      }),
    )
    root.flush()
    expect(container.innerHTML).toBe('<section>first</section>')

    root.render((handle) =>
      handle.host({
        type: 'section',
        key: 'root',
        props: { id: 'b', connect() {} },
        children: ['second'],
      }),
    )
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

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'root',
        props: { customState: 'first', connect() {} },
        children: ['hello'],
      }),
    )
    root.flush()

    let node = container.firstElementChild as HTMLDivElement
    expect(container.innerHTML).toBe('<div>hello</div>')
    expect(node.getAttribute('customState')).toBeNull()
  })
})

function createPassthroughPlugin(): Plugin {
  return () => () => (input: HostInput) => input
}
