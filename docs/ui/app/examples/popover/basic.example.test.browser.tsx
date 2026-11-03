import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, expectAnimation, input, key, mount, waitFor } from '../test-helpers.ts'

describe('Popover example', () => {
  it('focuses the first filter and restores focus after dismissal', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(document.body, 'Filter pull requests')
    let surface = element(document.body, '[role="dialog"]')
    let open = input(document.body, 'input[value="open"]')
    let merged = input(document.body, 'input[value="merged"]')
    assert.equal(surface.matches('[data-open]'), false)
    await result.act(() => trigger.click())
    await expectAnimation(surface)
    await waitFor(() => assert.equal(document.activeElement, open))
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    await result.act(() => merged.click())
    assert.equal(merged.checked, true)
    await result.act(() => key(merged, 'Escape'))
    await waitFor(() => assert.equal(surface.matches('[data-open]'), false))
    await waitFor(() => assert.equal(document.activeElement, trigger))
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    await result.act(() => trigger.click())
    await waitFor(() => assert.equal(document.activeElement, open))
    assert.equal(merged.checked, true)
    await result.act(() => trigger.click())
    await waitFor(() => assert.equal(surface.matches('[data-open]'), false))
  })
})
