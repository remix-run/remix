import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './controlled.example.tsx'
import { button, element, expectAnimation, key, mount } from '../test-helpers.ts'

describe('Controlled tabs example', () => {
  it('switches the visible panel by click and keyboard', async (t) => {
    let result = await mount(t, <Example />)
    let details = button(result.container, 'Details')
    let version = button(result.container, 'Version')
    let indicator = element(result.container, '[inert]')
    let detailsPanel = element(result.container, `[id="${details.getAttribute('aria-controls')}"]`)
    let versionPanel = element(result.container, `[id="${version.getAttribute('aria-controls')}"]`)
    assert.equal(details.getAttribute('aria-selected'), 'true')
    assert.equal(versionPanel.hidden, true)
    await result.act(() => version.click())
    await expectAnimation(indicator)
    assert.ok(Math.abs(indicator.getBoundingClientRect().x - version.getBoundingClientRect().x) < 1)
    assert.equal(version.getAttribute('aria-selected'), 'true')
    assert.equal(details.getAttribute('aria-selected'), 'false')
    assert.equal(versionPanel.hidden, false)
    assert.equal(detailsPanel.hidden, true)
    version.focus()
    await result.act(() => key(version, 'ArrowLeft'))
    await expectAnimation(indicator)
    assert.ok(Math.abs(indicator.getBoundingClientRect().x - details.getBoundingClientRect().x) < 1)
    assert.equal(document.activeElement, details)
    assert.equal(details.getAttribute('aria-selected'), 'true')
    assert.equal(detailsPanel.hidden, false)
  })
})
