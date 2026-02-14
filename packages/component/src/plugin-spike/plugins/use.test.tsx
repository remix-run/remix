import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { on } from './on.ts'
import { attributeProps } from './attribute-props.ts'
import { createDirective, use } from './use.ts'

describe('plugin-spike use plugin', () => {
  it('runs directive scopes with plugin setup once and node setup per host', () => {
    let pluginScopeCalls = 0
    let nodeScopeCalls = 0
    let updateCalls: string[] = []

    let track = createDirective((_) => {
      pluginScopeCalls++
      return (_host) => {
        nodeScopeCalls++
        return (value: string) => {
          updateCalls.push(value)
        }
      }
    })

    let value = 'first'
    let reconciler = createReconciler([use, attributeProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div>
        <button id="a" use={[track(value)]}>
          A
        </button>
        <button id="b" use={[track(value)]}>
          B
        </button>
      </div>
    ))
    root.flush()

    expect(pluginScopeCalls).toBe(1)
    expect(nodeScopeCalls).toBe(2)
    expect(updateCalls).toEqual(['first', 'first'])

    value = 'second'
    root.render(() => (
      <div>
        <button id="a" use={[track(value)]}>
          A
        </button>
        <button id="b" use={[track(value)]}>
          B
        </button>
      </div>
    ))
    root.flush()

    expect(pluginScopeCalls).toBe(1)
    expect(nodeScopeCalls).toBe(2)
    expect(updateCalls).toEqual(['first', 'first', 'second', 'second'])
  })

  it('supports on() directives through use=[...]', () => {
    let incrementBy = 1
    let count = 0
    let focused = 0
    let reconciler = createReconciler([use, attributeProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <button
        use={[
          on('click', (event) => {
            count += incrementBy
            let target: HTMLButtonElement = event.currentTarget
            void target
          }),
          on('focus', () => {
            focused++
          }),
        ]}
      >
        Click
      </button>
    ))
    root.flush()

    let button = container.querySelector('button')
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('expected button')
    }

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(count).toBe(1)
    button.dispatchEvent(new FocusEvent('focus'))
    expect(focused).toBe(1)

    incrementBy = 10
    root.render(() => (
      <button
        use={[
          on('click', () => {
            count += incrementBy
          }),
          on('focus', () => {
            focused++
          }),
        ]}
      >
        Click
      </button>
    ))
    root.flush()

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(count).toBe(11)
    button.dispatchEvent(new FocusEvent('focus'))
    expect(focused).toBe(2)
  })
})
