import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './disabled-item.example.tsx'
import { button, element, key, mount } from '../test-helpers.ts'

describe('Disabled tab example', () => {
  it('skips the unsupported preview while other tabs work', async (t) => {
    let result = await mount(t, <Example />)
    let details = button(result.container, 'Details')
    let version = button(result.container, 'Version')
    let preview = element(result.container, '[aria-describedby]')
    assert.equal(preview.hasAttribute('disabled'), true)
    await result.act(() => preview.click())
    assert.equal(details.getAttribute('aria-selected'), 'true')
    await result.act(() => version.click())
    assert.equal(version.getAttribute('aria-selected'), 'true')
    version.focus()
    await result.act(() => key(version, 'ArrowRight'))
    assert.equal(document.activeElement, details)
    assert.equal(details.getAttribute('aria-selected'), 'true')
  })
})
