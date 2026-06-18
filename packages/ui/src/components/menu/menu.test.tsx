import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, type RemixNode } from '@remix-run/ui'
import * as menu from '@remix-run/ui/menu'
import { onMenuSelect } from '@remix-run/ui/menu'

import { Menu, MenuItem, MenuList, Submenu } from './menu.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

function click(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
}

describe('Menu', () => {
  it('renders styled menu wrappers with ui primitive roles', async () => {
    let { container, root } = renderApp(
      <Menu label="View" menuLabel="View options">
        <MenuItem checked={false} name="wordWrap" type="checkbox">
          Word wrap
        </MenuItem>
        <Submenu label="Zoom">
          <MenuItem name="zoomIn" value="zoom-in">
            Zoom in
          </MenuItem>
        </Submenu>
      </Menu>,
    )

    let trigger = container.querySelector('button') as HTMLButtonElement
    click(trigger)
    await Promise.resolve()
    root.flush()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    root.flush()

    let list = container.querySelector('[role="menu"]') as HTMLElement
    let items = container.querySelectorAll('[role^="menuitem"]')

    expect(trigger.textContent).toContain('View')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-controls')).toBe(list.id)
    expect(list.getAttribute('aria-label')).toBe('View options')
    expect(items).toHaveLength(3)
  })

  it('renders MenuList for custom ui menu composition', () => {
    let { container } = renderApp(
      <menu.Context label="File actions">
        <MenuList>
          <MenuItem name="rename">Rename</MenuItem>
        </MenuList>
      </menu.Context>,
    )

    expect(container.querySelector('[popover]')).not.toBe(null)
    expect(container.querySelector('[role="menu"]')).not.toBe(null)
  })

  it('composes ui menu events from the trigger', async (t) => {
    let values: Array<string | null> = []
    let { container, root } = renderApp(
      <Menu
        label="View"
        mix={onMenuSelect((event) => {
          values.push(event.item.value)
        })}
      >
        <MenuItem name="zoomIn" value="zoom-in">
          Zoom in
        </MenuItem>
      </Menu>,
    )

    let trigger = container.querySelector('button') as HTMLButtonElement
    click(trigger)
    await Promise.resolve()
    root.flush()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    root.flush()

    let item = container.querySelector('[role="menuitem"]') as HTMLElement
    click(item)
    await Promise.resolve()
    root.flush()
    await t.useFakeTimers().advanceAsync(60)
    root.flush()

    expect(values).toEqual(['zoom-in'])
  })
})
