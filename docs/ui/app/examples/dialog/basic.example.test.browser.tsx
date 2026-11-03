import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, input, key, mount, waitFor } from '../test-helpers.ts'

describe('Dialog example', () => {
  it('saves a name through a portaled form and restores focus to Rename', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(result.container, 'Rename')
    await result.act(() => trigger.click())
    let surface = element(document.body, '[role="dialog"]')
    let field = input(surface)
    await waitFor(() => assert.equal(document.activeElement, field))
    assert.equal(result.container.contains(surface), false)
    assert.equal(surface.hasAttribute('popover'), false)
    await result.act(() => {
      field.value = 'Meeting notes'
      field.dispatchEvent(new InputEvent('input', { bubbles: true }))
      button(surface, 'Save').click()
    })
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.match(result.container.textContent ?? '', /Meeting notes/)
    assert.equal(document.activeElement, trigger)
    await result.act(() => trigger.click())
    await waitFor(() => assert.equal(document.activeElement, field))
    assert.equal(field.value, 'Meeting notes')
    await result.act(() => key(field, 'Escape'))
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.equal(document.activeElement, trigger)
  })
})
