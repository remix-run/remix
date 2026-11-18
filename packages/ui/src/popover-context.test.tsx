import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { createRoot, type Handle, type RemixNode } from '@remix-run/component'
import * as dialog from './dialog.ts'
import * as popover from './popover.ts'
import * as menu from './menu.tsx'
import * as select from './select.tsx'
import * as combobox from './combobox.tsx'
import { Portal } from './portal.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function Modal(handle: Handle<{ children: RemixNode }>) {
  return () => (
    <dialog.Context defaultOpen>
      <dialog.SurfaceContext>
        <section aria-label="Dialog" mix={dialog.surface()}>
          <input id="first" aria-label="First control" />
          {handle.props.children}
        </section>
      </dialog.SurfaceContext>
    </dialog.Context>
  )
}

function render(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  roots.push(root)
  root.render(node)
  root.flush()
  return root
}

function get(selector: string) {
  let node = document.querySelector<HTMLElement>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

async function settle(root: ReturnType<typeof createRoot>) {
  root.flush()
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
  root.flush()
}

afterEach(() => {
  for (let root of roots) root.dispose()
  roots = []
  document.body.innerHTML = ''
})

function expectContextError(node: RemixNode, message: string) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  roots.push(root)
  let errors: unknown[] = []
  root.addEventListener('error', (event) => errors.push(event.error))
  root.render(node)
  root.flush()
  expect(errors.length).toBe(1)
  expect(errors[0] instanceof Error && errors[0].message).toBe(message)
}

describe('pattern popover contexts', () => {
  it('connects a portaled menu to its modal without a public popover provider', async () => {
    let root = render(
      <Modal>
        <menu.Context label="Menu">
          <button id="trigger" mix={menu.trigger()}>
            Menu
          </button>
          <Portal>
            <menu.PopoverContext>
              <div id="popup" mix={menu.popover()}>
                <div mix={menu.list()}>
                  <button mix={menu.item({ name: 'action' })}>Action</button>
                </div>
              </div>
            </menu.PopoverContext>
          </Portal>
        </menu.Context>
      </Modal>,
    )
    await settle(root)
    get('#trigger').click()
    await settle(root)
    expect(get('#popup').hasAttribute('data-open')).toBe(true)
    expect(get('#popup').closest('[inert]')).toBe(null)
    let after = get('#popup').nextElementSibling
    if (!(after instanceof HTMLElement)) throw new Error('Missing popup boundary')
    expect(after.tabIndex).toBe(0)
    after.focus()
    expect(document.activeElement).toBe(get('#first'))
  })

  it('supplies a select popup provider while preserving its trigger and modal ownership', async () => {
    let root = render(
      <Modal>
        <select.Context defaultLabel="Choose">
          <button id="trigger" mix={select.trigger()} />
          <Portal>
            <select.PopoverContext>
              <div id="popup" mix={select.popover()}>
                <div id="list" mix={select.list()}>
                  <div mix={select.option({ label: 'Option A', value: 'a' })}>Option A</div>
                </div>
              </div>
            </select.PopoverContext>
          </Portal>
        </select.Context>
      </Modal>,
    )
    await settle(root)
    get('#trigger').click()
    await settle(root)
    expect(get('#popup').hasAttribute('data-open')).toBe(true)
    expect(document.activeElement).toBe(get('#list'))
    expect(get('#popup').closest('[inert]')).toBe(null)
    let after = get('#popup').nextElementSibling
    if (!(after instanceof HTMLElement)) throw new Error('Missing popup boundary')
    after.focus()
    expect(document.activeElement).toBe(get('#first'))
  })

  it('keeps combobox input focus while connecting its portaled list to the modal', async () => {
    let root = render(
      <Modal>
        <combobox.Context>
          <input id="input" aria-label="Combobox" mix={combobox.input()} />
          <Portal>
            <combobox.PopoverContext>
              <div id="popup" mix={combobox.popover()}>
                <div id="list" mix={combobox.list()}>
                  <div mix={combobox.option({ label: 'Option A', value: 'a' })}>Option A</div>
                </div>
              </div>
            </combobox.PopoverContext>
          </Portal>
        </combobox.Context>
      </Modal>,
    )
    await settle(root)
    get('#input').focus()
    get('#input').dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }),
    )
    await settle(root)
    expect(get('#popup').hasAttribute('data-open')).toBe(true)
    expect(document.activeElement).toBe(get('#input'))
    expect(get('#popup').closest('[inert]')).toBe(null)
    let after = get('#popup').nextElementSibling
    if (!(after instanceof HTMLElement)) throw new Error('Missing popup boundary')
    get('#list').focus()
    after.focus()
    expect(document.activeElement).toBe(get('#first'))
  })
})

describe('required surface contexts', () => {
  it('rejects a closed generic popover without its surface context', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <popover.Context>
        <div mix={popover.surface({ open: false, onHide() {} })} />
      </popover.Context>,
      'popover.surface() requires a matching popover.SurfaceContext ancestor',
    )
  })

  it('rejects a menu without its popover context', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <menu.Context>
        <div mix={menu.popover()} />
      </menu.Context>,
      'menu.popover() requires a matching menu.PopoverContext ancestor',
    )
  })

  it('rejects a select with only the legacy generic provider', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <select.Context defaultLabel="Choose">
        <popover.Context>
          <div mix={select.popover()} />
        </popover.Context>
      </select.Context>,
      'select.popover() requires a matching select.PopoverContext ancestor',
    )
  })

  it('rejects a combobox without its popover context', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <combobox.Context>
        <div mix={combobox.popover()} />
      </combobox.Context>,
      'combobox.popover() requires a matching combobox.PopoverContext ancestor',
    )
  })

  it('rejects a generic surface using an outer popover instance boundary', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <popover.Context>
        <popover.SurfaceContext>
          <popover.Context>
            <div mix={popover.surface({ open: false, onHide() {} })} />
          </popover.Context>
        </popover.SurfaceContext>
      </popover.Context>,
      'popover.surface() requires a matching popover.SurfaceContext ancestor',
    )
  })

  it('rejects a nested menu using its parent menu boundary', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <menu.Context>
        <menu.PopoverContext>
          <menu.Context>
            <div mix={menu.popover()} />
          </menu.Context>
        </menu.PopoverContext>
      </menu.Context>,
      'menu.popover() requires a matching menu.PopoverContext ancestor',
    )
  })

  it('rejects a nested select using another select instance boundary', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <select.Context defaultLabel="Outer">
        <select.PopoverContext>
          <select.Context defaultLabel="Inner">
            <div mix={select.popover()} />
          </select.Context>
        </select.PopoverContext>
      </select.Context>,
      'select.popover() requires a matching select.PopoverContext ancestor',
    )
  })

  it('rejects a nested combobox using another combobox instance boundary', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <combobox.Context>
        <combobox.PopoverContext>
          <combobox.Context>
            <div mix={combobox.popover()} />
          </combobox.Context>
        </combobox.PopoverContext>
      </combobox.Context>,
      'combobox.popover() requires a matching combobox.PopoverContext ancestor',
    )
  })

  it('rejects a menu surface wrapped only in the generic surface context', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <menu.Context>
        <popover.SurfaceContext>
          <div mix={menu.popover()} />
        </popover.SurfaceContext>
      </menu.Context>,
      'menu.popover() requires a matching menu.PopoverContext ancestor',
    )
  })

  it('rejects a nested dialog using its parent dialog boundary', (t) => {
    t.mock.method(console, 'error', () => {})
    expectContextError(
      <dialog.Context>
        <dialog.SurfaceContext>
          <dialog.Context>
            <section mix={dialog.surface()} />
          </dialog.Context>
        </dialog.SurfaceContext>
      </dialog.Context>,
      'dialog.surface() requires a dialog.SurfaceContext ancestor',
    )
  })

  it('rejects a menu boundary rendered outside its portal destination', async (t) => {
    t.mock.method(console, 'error', () => {})
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    roots.push(root)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    root.render(
      <menu.Context>
        <menu.PopoverContext>
          <Portal>
            <div mix={menu.popover()} />
          </Portal>
        </menu.PopoverContext>
      </menu.Context>,
    )
    await settle(root)
    expect(errors.length).toBe(1)
    expect(errors[0] instanceof Error && errors[0].message).toBe(
      'SurfaceContext must wrap its surface at the DOM destination. Place it inside Portal.',
    )
  })
})
