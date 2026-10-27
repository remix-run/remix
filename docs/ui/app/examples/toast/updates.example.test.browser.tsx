import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './updates.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Toast update example', () => {
  it('updates one upload record through failure, retry and timed success', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Simulate upload').click())
    let toastItem = element(result.container, '[data-toast]')
    assert.match(toastItem.textContent ?? '', /Uploading Notes.md/)
    assert.equal(element(toastItem, 'div[aria-hidden="true"]').hidden, true)
    await result.act(() => button(result.container, 'Fail').click())
    assert.equal(element(result.container, '[data-toast]'), toastItem)
    assert.match(toastItem.textContent ?? '', /Upload failed/)
    await result.act(() => button(result.container, 'Retry').click())
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 1)
    assert.match(toastItem.textContent ?? '', /Uploading Notes.md/)
    await result.act(() => button(result.container, 'Complete').click())
    assert.equal(element(result.container, '[data-toast]'), toastItem)
    assert.match(toastItem.textContent ?? '', /Upload complete/)
    assert.equal(element(toastItem, 'div[aria-hidden="true"]').hidden, false)
    assert.equal(result.container.querySelector('[data-toast] button:not([aria-label])'), null)
    await result.act(() => button(result.container, 'Simulate upload').click())
    await result.act(() => button(result.container, 'Dismiss notification').click())
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
    assert.equal(button(result.container, 'Simulate upload').disabled, false)
    assert.equal(button(result.container, 'Complete').disabled, true)
    await result.act(() => button(result.container, 'Simulate upload').click())
    assert.match(element(result.container, '[data-toast]').textContent ?? '', /Uploading Notes.md/)
    await result.act(() => button(result.container, 'Complete').click())
  })
})
