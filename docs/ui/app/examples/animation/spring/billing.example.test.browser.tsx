import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './billing.example.tsx'
import { element, expectAnimation, input, mount } from '../../test-helpers.ts'

describe('Spring billing example', () => {
  it('animates the selected period on first use and on return', async (t) => {
    let result = await mount(t, <Example />)
    let highlight = element(result.container, '[inert]')
    let monthly = input(result.container, 'label:first-of-type input')
    let yearly = input(result.container, 'label:last-of-type input')
    let start = highlight.getBoundingClientRect().x
    await result.act(() => yearly.click())
    await expectAnimation(highlight)
    assert.equal(yearly.checked, true)
    assert.equal(monthly.checked, false)
    assert.ok(highlight.getBoundingClientRect().x > start)
    await result.act(() => monthly.click())
    await expectAnimation(highlight)
    assert.equal(monthly.checked, true)
    assert.ok(Math.abs(highlight.getBoundingClientRect().x - start) < 1)
    let other = await mount(t, <Example />)
    await other.act(() => input(other.container, 'label:last-of-type input').click())
    assert.equal(monthly.checked, true)
    assert.equal(input(other.container, 'label:last-of-type input').checked, true)
  })
})
