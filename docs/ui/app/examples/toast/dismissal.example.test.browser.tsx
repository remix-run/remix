import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './dismissal.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Toast programmatic dismissal example', () => {
  it('dismisses the newest toast independently and closes the remaining collection', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    let dismissNewest = button(result.container, 'Dismiss newest')
    let dismissAll = button(result.container, 'Dismiss all')
    assert.equal(dismissNewest.disabled, true)
    assert.equal(dismissAll.disabled, true)

    await result.act(() => button(result.container, 'Show toast').click())
    let first = element(result.container, '[data-toast]')
    await result.act(() => button(result.container, 'Show toast').click())
    let second = element(result.container, '[data-toast-index="0"]')
    assert.match(second.textContent ?? '', /Toast 2/)
    assert.equal(dismissNewest.disabled, false)

    await result.act(() => dismissNewest.click())
    await waitFor(() => assert.equal(second.isConnected, false))
    assert.equal(first.isConnected, true)
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 1)

    await result.act(() => button(result.container, 'Show toast').click())
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 2)
    await result.act(() => dismissAll.click())
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
    assert.equal(dismissNewest.disabled, true)
    assert.equal(dismissAll.disabled, true)
  })
})
