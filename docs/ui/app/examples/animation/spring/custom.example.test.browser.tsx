import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './custom.example.tsx'
import { button, expectAnimation, mount } from '../../test-helpers.ts'

describe('Custom spring example', () => {
  it('animates the bookmark without moving or resizing the button', async (t) => {
    let result = await mount(t, <Example />)
    let bookmark = button(result.container, 'Bookmark')
    let icon = bookmark.querySelector('svg')
    assert.ok(icon)
    let start = bookmark.getBoundingClientRect()
    await result.act(() => bookmark.click())
    await expectAnimation(icon)
    assert.equal(bookmark.getAttribute('aria-pressed'), 'true')
    assert.ok(new DOMMatrixReadOnly(getComputedStyle(icon).transform).a > 1)
    assert.equal(bookmark.getBoundingClientRect().width, start.width)
    assert.equal(bookmark.getBoundingClientRect().x, start.x)
    await result.act(() => bookmark.click())
    await expectAnimation(icon)
    assert.equal(bookmark.getAttribute('aria-pressed'), 'false')
    assert.equal(new DOMMatrixReadOnly(getComputedStyle(icon).transform).a, 1)
    assert.equal(bookmark.getBoundingClientRect().width, start.width)
  })
})
