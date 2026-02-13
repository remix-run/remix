import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { attributeProps } from './attribute-props.ts'
import { component } from './component.ts'
import { interactions } from './interaction.ts'

describe('plugin-spike component plugin', () => {
  it('renders jsx host elements from root.render', () => {
    let reconciler = createReconciler([attributeProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => <div id="root">hello</div>)
    root.flush()

    expect(container.innerHTML).toBe('<div id="root">hello</div>')
  })

  it('creates component render scope once and reuses it across renders', () => {
    let setupCalls = 0
    let renderCalls = 0

    function Counter(_handle: unknown) {
      setupCalls++
      let count = 0
      return (props: Record<string, unknown>) => {
        renderCalls++
        count++
        return <div data-count={String(count)}>{String(props.label ?? '')}</div>
      }
    }

    let reconciler = createReconciler([component, attributeProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => <Counter label="a" />)
    root.flush()
    expect(container.innerHTML).toBe('<div data-count="1">a</div>')
    expect(setupCalls).toBe(1)
    expect(renderCalls).toBe(1)

    root.render(() => <Counter label="b" />)
    root.flush()
    expect(container.innerHTML).toBe('<div data-count="2">b</div>')
    expect(setupCalls).toBe(1)
    expect(renderCalls).toBe(2)
  })

  it('supports component handle update from event listeners', () => {
    function Counter(handle: any) {
      let count = 0
      return () => (
        <button
          on={{
            click: () => {
              count++
              handle.update()
            },
          }}
        >
          count:{count}
        </button>
      )
    }

    let reconciler = createReconciler([component, interactions, attributeProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => <Counter />)
    root.flush()
    expect(container.textContent).toBe('count:0')

    let button = container.querySelector('button')
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('expected button')
    }
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    root.flush()

    expect(container.textContent).toBe('count:1')
  })
})
