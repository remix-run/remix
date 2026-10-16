import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './reordering.example.tsx'
import { element, expectAnimation, input, mount } from '../../test-helpers.ts'

describe('Layout reordering example', () => {
  it('animates keyed tasks when sorting in either direction', async (t) => {
    let result = await mount(t, <Example />)
    let due = input(result.container, 'label:first-child input')
    let priority = input(result.container, 'label:last-child input')
    let notes = element(result.container, 'li:first-child')
    assert.ok(notes.textContent?.includes('Write release notes'))
    await result.act(() => priority.click())
    await expectAnimation(notes)
    assert.ok(
      element(result.container, 'li:first-child').textContent?.includes('Review security changes'),
    )
    assert.equal(element(result.container, 'li:last-child'), notes)
    assert.equal(priority.checked, true)
    assert.equal(getComputedStyle(notes).transform, 'none')
    await result.act(() => due.click())
    await expectAnimation(notes)
    assert.equal(element(result.container, 'li:first-child'), notes)
    assert.equal(due.checked, true)
    let other = await mount(t, <Example />)
    await other.act(() => input(other.container, 'label:last-child input').click())
    assert.equal(due.checked, true)
    assert.equal(input(other.container, 'label:last-child input').checked, true)
  })
})
