import { describe, expect, it } from 'vitest'

import { createReconciler } from './index.ts'
import type { HostInput, Plugin } from './types.ts'

describe('plugin-spike plugins', () => {
  it('composes host transforms in plugin array order', () => {
    let events: string[] = []
    let pluginA = createPlugin('a', events)
    let pluginB = createPlugin('b', events)
    let reconciler = createReconciler([pluginA, pluginB])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'root',
        props: { connect() {} },
        children: [],
      }),
    )
    root.flush()

    expect(events).toEqual([
      'before-a',
      'before-b',
      'transform-a',
      'transform-b',
      'after-a',
      'after-b',
    ])
    expect(container.innerHTML).toBe('<div></div>')
  })
})

function createPlugin(name: string, events: string[]): Plugin {
  return (pluginHandle) => {
    pluginHandle.addEventListener('beforeFlush', () => {
      events.push(`before-${name}`)
    })
    pluginHandle.addEventListener('afterFlush', () => {
      events.push(`after-${name}`)
    })

    return () => (input: HostInput) => {
      events.push(`transform-${name}`)
      let props = { ...input.props, [`data-transform-${name}`]: true }
      return { ...input, props }
    }
  }
}
