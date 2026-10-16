import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './chart.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Chart anchor example', () => {
  it('reanchors the visit readout for pointer and keyboard selection', async (t) => {
    let result = await mount(t, <Example />)
    let bubble = element(result.container, '[data-readout]')
    let monday = button(result.container, 'Mon, 840 visits')
    let tuesday = button(result.container, 'Tue, 1,120 visits')
    assert.equal(bubble.inert, true)
    assert.equal(bubble.getAttribute('aria-hidden'), 'true')
    await result.act(() => monday.dispatchEvent(new PointerEvent('pointerenter')))
    assert.equal(monday.getAttribute('aria-pressed'), 'true')
    assert.equal(element(bubble, 'strong').textContent, '840')
    await result.act(() => monday.focus())
    await result.act(() => key(monday, 'ArrowRight'))
    assert.equal(document.activeElement, tuesday)
    assert.equal(tuesday.getAttribute('aria-pressed'), 'true')
    assert.equal(element(bubble, 'strong').textContent, '1,120')
    await waitFor(() => {
      let point = element(tuesday, '[data-point]').getBoundingClientRect()
      let readout = bubble.getBoundingClientRect()
      assert.ok(readout.width > 0)
      assert.ok(readout.bottom <= point.top)
      assert.ok(Math.abs(readout.x + readout.width / 2 - point.x - point.width / 2) < 2)
    })
    await result.act(() => key(tuesday, 'End'))
    assert.equal(document.activeElement, button(result.container, 'Sun, 1,520 visits'))
    await result.act(() => button(result.container, 'Thu, 1,480 visits').click())
    assert.equal(element(bubble, 'strong').textContent, '1,480')
  })
})
