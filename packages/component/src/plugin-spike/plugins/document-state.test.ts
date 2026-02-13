import { describe, expect, it } from 'vitest'

import { createReconciler, documentStatePlugin } from '../index.ts'
import type { Plugin } from '../types.ts'

describe('plugin-spike document state plugin', () => {
  it('restores focus when active element is replaced with same id', () => {
    let revision = 1
    let reconciler = createReconciler([createIdPlugin(), documentStatePlugin])
    let container = document.createElement('div')
    document.body.append(container)
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'button',
        key: `button-${revision}`,
        props: { id: 'focus-target', connect() {} },
        children: [`label-${revision}`],
      }),
    )
    root.flush()

    let firstButton = container.querySelector('#focus-target')
    if (!(firstButton instanceof HTMLButtonElement)) {
      throw new Error('expected initial focus target button')
    }
    firstButton.focus()
    expect(document.activeElement).toBe(firstButton)

    revision = 2
    root.render((handle) =>
      handle.host({
        type: 'button',
        key: `button-${revision}`,
        props: { id: 'focus-target', connect() {} },
        children: [`label-${revision}`],
      }),
    )
    root.flush()

    let secondButton = container.querySelector('#focus-target')
    if (!(secondButton instanceof HTMLButtonElement)) {
      throw new Error('expected updated focus target button')
    }
    expect(secondButton).not.toBe(firstButton)
    expect(document.activeElement).toBe(secondButton)
    expect(secondButton.textContent).toBe('label-2')

    root.dispose()
    container.remove()
  })
})

function createIdPlugin(): Plugin {
  return () => (host) => {
    host.addEventListener('afterFlush', (event) => {
      let id = event.input.props.id
      if (typeof id === 'string' && id.length > 0) {
        event.node.setAttribute('id', id)
      } else {
        event.node.removeAttribute('id')
      }
    })
  }
}
