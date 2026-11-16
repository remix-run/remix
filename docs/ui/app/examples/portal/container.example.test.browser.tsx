import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './container.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Portal container example', () => {
  it('moves the counter between destinations without resetting its state', async (t) => {
    let view = await mount(t, <Example />)
    let first = element(view.container, '[aria-label="Container A"]')
    let second = element(view.container, '[aria-label="Container B"]')
    await waitFor(() => assert.ok(first.querySelector('button')))
    let counter = button(first, 'Count: 0')
    await view.act(() => counter.click())
    assert.equal(counter.textContent, 'Count: 1')
    await view.act(() => button(view.container, 'Move content').click())
    await waitFor(() => assert.ok(second.contains(counter)))
    assert.equal(first.querySelector('button'), null)
    assert.equal(counter.textContent, 'Count: 1')
    await view.act(() => counter.click())
    await view.act(() => button(view.container, 'Move content').click())
    await waitFor(() => assert.ok(first.contains(counter)))
    assert.equal(counter.textContent, 'Count: 2')
    assert.equal(second.querySelector('button'), null)
  })
})
