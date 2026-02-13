import { describe, expect, it } from 'vitest'

import { createReconciler } from './index.ts'
import type { Plugin } from './types.ts'

describe('plugin-spike scheduler', () => {
  it('runs beforeFlush and afterFlush around a batched flush', () => {
    let events: string[] = []
    let plugin = createLoggingPlugin(events)
    let reconciler = createReconciler([plugin])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'root',
        props: { 'data-value': 'a', connect() {} },
        children: [],
      }),
    )
    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'root',
        props: { 'data-value': 'b', connect() {} },
        children: [],
      }),
    )

    root.flush()

    expect(events).toEqual(['before-1', 'after-1'])
    expect(container.innerHTML).toBe('<div></div>')
  })
})

function createLoggingPlugin(events: string[]): Plugin {
  return (pluginHandle) => {
    pluginHandle.addEventListener('beforeFlush', (event) => {
      events.push(`before-${event.context.flushId}`)
    })
    pluginHandle.addEventListener('afterFlush', (event) => {
      events.push(`after-${event.context.flushId}`)
    })
    return () => (input) => input
  }
}
