import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, input, mount, waitFor } from '../test-helpers.ts'

describe('Select example', () => {
  it('updates the displayed label and value after selecting a delivery method', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(document.body, 'Standard delivery')
    assert.equal(
      element(
        document.body,
        `[id="${trigger.getAttribute('aria-labelledby')}"]`,
      ).textContent?.trim(),
      'Delivery method',
    )
    assert.equal(trigger.textContent?.trim(), 'Standard delivery')
    await result.act(() => trigger.click())
    assert.equal(element(document.body, '[data-popover]').matches('[data-open]'), true)
    await result.act(() => element(document.body, '[role="option"]:nth-child(2)').click())
    await waitFor(() => assert.equal(input(document.body, 'input[type="hidden"]').value, 'express'))
    await waitFor(() =>
      assert.equal(element(document.body, '[data-popover]').matches('[data-open]'), false),
    )
    await waitFor(() => assert.equal(trigger.textContent?.trim(), 'Express delivery'))
    assert.equal(document.activeElement, trigger)
  })
})
