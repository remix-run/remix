import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './timing.example.tsx'
import { element, input, mount, waitFor } from '../../test-helpers.ts'

describe('Tween example', () => {
  it('interpolates revenue for each period and supports changing direction during playback', async (t) => {
    let result = await mount(t, <Example />)
    let amount = element(result.container, ':scope > div > div:last-child > strong')
    let day = input(result.container, 'label:first-child input')
    let week = input(result.container, 'label:nth-child(2) input')
    let month = input(result.container, 'label:last-child input')
    assert.equal(amount.textContent, '$12,480')
    await result.act(() => day.click())
    await waitFor(() => {
      assert.notEqual(amount.textContent, '$12,480')
      assert.notEqual(amount.textContent, '$416')
    })
    await waitFor(() => assert.equal(amount.textContent, '$416'))
    await result.act(() => week.click())
    await waitFor(() => assert.notEqual(amount.textContent, '$416'))
    await result.act(() => month.click())
    await waitFor(() => assert.equal(amount.textContent, '$12,480'))
    assert.equal(month.checked, true)
    assert.equal(day.checked, false)
    let other = await mount(t, <Example />)
    await other.act(() => input(other.container, 'label:first-child input').click())
    assert.equal(month.checked, true)
    assert.equal(input(other.container, 'label:first-child input').checked, true)
  })
})
