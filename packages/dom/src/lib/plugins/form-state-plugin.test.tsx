import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'

import { createDomNodePolicy } from '../dom-node-policy.ts'
import { formStatePlugin } from './form-state-plugin.ts'

describe('formStatePlugin', () => {
  it('updates and resets input value/checked', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<input value="hello" checked />)
    root.flush()

    let input = container.firstElementChild as HTMLInputElement
    expect(input.value).toBe('hello')
    expect(input.checked).toBe(true)

    root.render(<input value={null} checked={null} />)
    root.flush()

    let next = container.firstElementChild as HTMLInputElement
    expect(next.value).toBe('')
    expect(next.checked).toBe(false)
  })

  it('handles selectedIndex and selected resets', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(
      <select selectedIndex={1}>
        <option>One</option>
        <option>Two</option>
      </select>,
    )
    root.flush()

    let select = container.firstElementChild as HTMLSelectElement
    expect(select.selectedIndex).toBe(1)

    root.render(
      <select selectedIndex={null}>
        <option selected>One</option>
        <option>Two</option>
      </select>,
    )
    root.flush()

    let nextSelect = container.firstElementChild as HTMLSelectElement
    expect(nextSelect.selectedIndex).toBe(-1)
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), [formStatePlugin])
  return reconciler.createRoot(container)
}
