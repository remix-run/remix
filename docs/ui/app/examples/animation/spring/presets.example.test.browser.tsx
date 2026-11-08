import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './presets.example.tsx'
import { button, expectAnimation, mount } from '../../test-helpers.ts'

describe('Spring presets example', () => {
  it('animates all three presets back and forth from one button', async (t) => {
    let result = await mount(t, <Example />)
    let dots = result.$$(':scope > div > div > div > div')
    assert.equal(dots.length, 3)
    let positions = [...dots].map((dot) => dot.getBoundingClientRect().x)
    await result.act(() => button(result.container, 'Animate').click())
    await Promise.all([...dots].map((dot) => expectAnimation(dot)))
    for (let [index, dot] of [...dots].entries()) {
      assert.ok(dot.getBoundingClientRect().x > positions[index] + 100)
    }
    await result.act(() => button(result.container, 'Animate').click())
    await Promise.all([...dots].map((dot) => expectAnimation(dot)))
    for (let [index, dot] of [...dots].entries()) {
      assert.ok(Math.abs(dot.getBoundingClientRect().x - positions[index]) < 1)
    }
  })
})
