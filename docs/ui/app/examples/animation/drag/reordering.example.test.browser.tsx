import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './reordering.example.tsx'
import { button, element, frame, mount, waitFor } from '../../test-helpers.ts'
import { pointer } from './drag-test-helpers.ts'

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.2, `${actual} should equal ${expected}`)
}

function order(list: HTMLElement) {
  return [...list.children].map((row) => row.getAttribute('aria-label'))
}

async function finishLayout(list: HTMLElement) {
  for (let animation of list.getAnimations({ subtree: true })) animation.finish()
  await frame()
}

describe('Drag and layout reordering', () => {
  it('keeps the row under the pointer across multiple swaps and settles into its new slot', async (t) => {
    let result = await mount(t, <Example />)
    let list = element(result.container, '[aria-label="Work queue"]')
    let row = element(list, '[aria-label="Review API"]')
    let next = element(list, '[aria-label="Update examples"]')
    let home = row.getBoundingClientRect()
    let step = next.offsetTop - row.offsetTop
    let x = home.left + 40
    let y = home.top + home.height / 2
    pointer(row, 'pointerdown', x, y)
    pointer(row, 'pointermove', x, y + step + 8)
    await frame()
    assert.equal(order(list)[1], 'Review API')
    near(row.getBoundingClientRect().top, home.top + step + 8)
    assert.ok(next.getAnimations().length > 0, 'the displaced sibling animates')
    await finishLayout(list)
    near(row.getBoundingClientRect().top, home.top + step + 8)
    pointer(row, 'pointermove', x, y + step * 2 + 8)
    await frame()
    assert.equal(order(list)[2], 'Review API')
    near(row.getBoundingClientRect().top, home.top + step * 2 + 8)
    await finishLayout(list)
    pointer(row, 'pointermove', x, y + step + 20)
    await frame()
    near(row.getBoundingClientRect().top, home.top + step + 20)
    pointer(row, 'pointerup', x, y + step + 20)
    await waitFor(() => near(row.getBoundingClientRect().top, home.top + step * 2))
    assert.equal(row.getAttribute('data-dragging'), null)
    assert.equal(element(list, '[aria-label="Review API"]'), row)
    assert.equal(
      element(result.container, '[aria-label="Reorder work queue"] [role="status"]').textContent,
      'Review API, position 3 of 4',
    )
  })

  it('supports moving upward, cancelling and dragging again from the committed order', async (t) => {
    let result = await mount(t, <Example />)
    let list = element(result.container, '[aria-label="Work queue"]')
    let row = element(list, '[aria-label="Publish preview"]')
    let previous = element(list, '[aria-label="Run tests"]')
    let home = row.getBoundingClientRect()
    let step = row.offsetTop - previous.offsetTop
    let x = home.left + 40
    let y = home.top + home.height / 2
    pointer(row, 'pointerdown', x, y)
    pointer(row, 'pointermove', x, y - step * 2 - 8)
    await frame()
    await finishLayout(list)
    assert.equal(order(list)[1], 'Publish preview')
    near(row.getBoundingClientRect().top, home.top - step * 2 - 8)
    pointer(row, 'pointercancel', x, y - step * 2 - 8)
    await waitFor(() => near(row.getBoundingClientRect().top, home.top - step * 2))
    let settled = row.getBoundingClientRect()
    pointer(row, 'pointerdown', x, settled.top + 20)
    pointer(row, 'pointermove', x, settled.top + 35)
    near(row.getBoundingClientRect().top, settled.top + 15)
    pointer(row, 'pointerup', x, settled.top + 35)
    await waitFor(() => near(row.getBoundingClientRect().top, settled.top))
  })

  it('offers the same reordering operation through focused buttons without starting a drag', async (t) => {
    let result = await mount(t, <Example />)
    let list = element(result.container, '[aria-label="Work queue"]')
    let row = element(list, '[aria-label="Review API"]')
    assert.equal(button(row, 'Move Review API up').getAttribute('aria-disabled'), 'true')
    let down = button(row, 'Move Review API down')
    down.focus()
    down.click()
    await frame()
    await finishLayout(list)
    assert.equal(order(list)[1], 'Review API')
    assert.equal(document.activeElement, down)
    assert.equal(row.getAttribute('data-dragging'), null)
    let up = button(row, 'Move Review API up')
    up.focus()
    up.click()
    await frame()
    await finishLayout(list)
    assert.equal(order(list)[0], 'Review API')
    assert.equal(document.activeElement, up)
    up.click()
    await frame()
    assert.equal(order(list)[0], 'Review API')
    assert.equal(button(row, 'Move Review API up').getAttribute('aria-disabled'), 'true')
  })
})
