import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { element, input, mount } from '../test-helpers.ts'

describe('Toggle example', () => {
  it('toggles from the label as well as the checkbox', async (t) => {
    let result = await mount(t, <Example />)
    let checkbox = input(result.container)
    assert.equal(
      element(result.container, `[id="${checkbox.getAttribute('aria-labelledby')}"]`).textContent,
      'Email notifications',
    )
    assert.equal(
      element(result.container, `[id="${checkbox.getAttribute('aria-describedby')}"]`).textContent,
      'Updates about your projects',
    )
    assert.equal(checkbox.checked, true)
    await result.act(() => element(result.container, 'strong').click())
    assert.equal(checkbox.checked, false)
    await result.act(() => checkbox.click())
    assert.equal(checkbox.checked, true)
  })
})
