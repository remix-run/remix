import * as assert from 'remix/assert'
import { describe, it, type TestContext } from 'remix/test'
import Example from './timing.example.tsx'
import { element, input, mount } from '../../test-helpers.ts'

describe('Tween example', () => {
  it('interpolates revenue for each period and supports changing direction during playback', async (t) => {
    let result = await mount(t, <Example />)
    let frames = mockAnimationFrames(t)
    let amount = element(result.container, ':scope > div > div:last-child > strong')
    let day = input(result.container, 'label:first-child input')
    let week = input(result.container, 'label:nth-child(2) input')
    let month = input(result.container, 'label:last-child input')
    assert.equal(amount.textContent, '$12,480')
    await result.act(() => day.click())
    await result.act(() => frames.run(0))
    await result.act(() => frames.run(300))
    assert.notEqual(amount.textContent, '$12,480')
    assert.notEqual(amount.textContent, '$416')
    await result.act(() => frames.run(600))
    assert.equal(amount.textContent, '$416')
    await result.act(() => week.click())
    await result.act(() => frames.run(1000))
    await result.act(() => frames.run(1300))
    let midWeek = amount.textContent
    assert.notEqual(midWeek, '$416')
    await result.act(() => month.click())
    await result.act(() => frames.run(2000))
    assert.equal(amount.textContent, midWeek)
    await result.act(() => frames.run(2600))
    assert.equal(amount.textContent, '$12,480')
    assert.equal(month.checked, true)
    assert.equal(day.checked, false)
    let other = await mount(t, <Example />)
    await other.act(() => input(other.container, 'label:first-child input').click())
    assert.equal(month.checked, true)
    assert.equal(input(other.container, 'label:first-child input').checked, true)
  })
})

// Drives the example's requestAnimationFrame loop with explicit timestamps.
function mockAnimationFrames(t: TestContext) {
  let callbacks = new Map<number, FrameRequestCallback>()
  let nextId = 1
  t.mock.method(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
    let id = nextId++
    callbacks.set(id, callback)
    return id
  })
  t.mock.method(window, 'cancelAnimationFrame', (id: number) => {
    callbacks.delete(id)
  })

  return {
    run(timestamp: number) {
      let pending = [...callbacks.values()]
      callbacks.clear()
      for (let callback of pending) callback(timestamp)
    },
  }
}
