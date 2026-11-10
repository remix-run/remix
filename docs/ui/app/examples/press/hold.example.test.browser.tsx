import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './hold.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

function pointer(target: HTMLElement, type: 'pointerdown' | 'pointerup') {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      isPrimary: true,
      pointerType: 'mouse',
    }),
  )
}

describe('Press hold example', () => {
  it('deletes after the hold and restores on undo', async (t) => {
    let result = await mount(t, <Example />)

    await result.act(() => pointer(button(result.container, 'Hold to delete'), 'pointerdown'))
    await waitFor(() => assert.ok(result.container.textContent?.includes('Deleted')))

    await result.act(() => pointer(button(result.container, 'Undo'), 'pointerdown'))
    assert.ok(button(result.container, 'Hold to delete'))
  })

  it('does not delete a hold that is released early', async (t) => {
    let result = await mount(t, <Example />)
    let hold = button(result.container, 'Hold to delete')

    await result.act(() => pointer(hold, 'pointerdown'))
    await result.act(() => pointer(hold, 'pointerup'))
    await new Promise((resolve) => setTimeout(resolve, 900))
    assert.equal(element(result.container, 'button').textContent?.trim(), 'Hold to delete')
  })
})
