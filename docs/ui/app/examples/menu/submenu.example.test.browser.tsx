import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './submenu.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Submenu example', () => {
  it('opens the export submenu by keyboard and dismisses the whole menu on selection', async (t) => {
    let result = await mount(t, <Example />)
    await result.act(() => button(document.body, 'File').click())
    let submenuTrigger = element(document.body, '[role="menuitem"][aria-haspopup="menu"]')
    await result.act(() => submenuTrigger.focus())
    await result.act(() => key(submenuTrigger, 'ArrowRight'))
    await waitFor(() => assert.equal(document.body.querySelectorAll('[data-open]').length, 2))
    let pdf = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === 'PDF',
    )
    assert.ok(pdf)
    await result.act(() => pdf.click())
    await waitFor(() => assert.equal(document.body.querySelectorAll('[data-open]').length, 0))
    await waitFor(() => assert.equal(document.activeElement, button(document.body, 'File')))
  })
})
