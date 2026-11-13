import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './read-only.example.tsx'
import { element, input, mount } from '../test-helpers.ts'

describe('Read-only toggle example', () => {
  it('preserves checked state while remaining focusable', async (t) => {
    let result = await mount(t, <Example />)
    let checkbox = input(result.container)
    assert.equal(
      element(result.container, `[id="${checkbox.getAttribute('aria-labelledby')}"]`).textContent,
      'Audit logging',
    )
    assert.equal(
      element(result.container, `[id="${checkbox.getAttribute('aria-describedby')}"]`).textContent,
      'Managed by your organization',
    )
    assert.equal(checkbox.disabled, false)
    checkbox.focus()
    assert.equal(document.activeElement, checkbox)
    await result.act(() => checkbox.click())
    assert.equal(checkbox.checked, true)
    await result.act(() => element(result.container, 'label').click())
    assert.equal(checkbox.checked, true)
  })
})
