import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'
import { renderToString } from '@remix-run/component/server'
import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import * as dialog from './dialog.ts'
import * as popover from './popover.ts'
import * as menu from './menu.tsx'
import * as select from './select.tsx'
import * as combobox from './combobox.tsx'

let roots: ReturnType<typeof createRoot>[] = []
function render(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  roots.push(root)
  let errors: unknown[] = []
  root.addEventListener('error', (event) => errors.push(event.error))
  root.render(node)
  root.flush()
  return { root, errors }
}
function get(selector: string) {
  let node = document.querySelector<HTMLElement>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}
async function settle() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}
function Popup(
  handle: Handle<{ container?: HTMLElement; changed?: boolean; open?: boolean; mounted?: boolean }>,
) {
  return () => (
    <popover.Context>
      <button id="anchor" mix={popover.anchor({ placement: 'bottom' })}>
        Open
      </button>
      <popover.Portal container={handle.props.container}>
        {handle.props.mounted === false ? null : (
          <popover.SurfaceContext>
            <div id="popup" mix={popover.surface({ open: handle.props.open ?? true, onHide() {} })}>
              <input id="first" tabIndex={handle.props.changed ? -1 : undefined} />
              <input id="last" tabIndex={handle.props.changed ? 0 : undefined} />
              {handle.props.changed ? <input id="added" /> : null}
              <Counter />
            </div>
          </popover.SurfaceContext>
        )}
      </popover.Portal>
    </popover.Context>
  )
}
function Counter(handle: Handle) {
  let count = 0
  return () => (
    <button
      id="counter"
      mix={on('click', () => {
        count++
        void handle.update()
      })}
    >
      {count}
    </button>
  )
}
afterEach(() => {
  for (let root of roots) root.dispose()
  roots = []
  document.body.innerHTML = ''
})

describe('Portal components', () => {
  it('preserves state on updates, remounts for a new container, and restores removed attributes', async () => {
    let first = document.createElement('aside')
    let second = document.createElement('aside')
    document.body.append(first, second)
    let { root, errors } = render(<Popup container={first} />)
    await settle()
    let input = get('#first')
    let counter = get('#counter')
    counter.click()
    await settle()
    root.render(<Popup container={first} />)
    root.flush()
    await settle()
    expect(get('#counter')).toBe(counter)
    expect(counter.textContent).toBe('1')
    root.render(<Popup container={second} />)
    root.flush()
    await settle()
    let replacement = get('#counter')
    expect(replacement).not.toBe(counter)
    expect(replacement.textContent).toBe('0')
    expect(second.contains(replacement)).toBe(true)
    expect(input.isConnected).toBe(false)
    expect(input.getAttribute('tabindex')).toBe(null)
    root.render(null)
    root.flush()
    expect(replacement.isConnected).toBe(false)
    expect(errors).toEqual([])
  })
  it('keeps accessibility ownership stable across updates and container moves', async () => {
    let first = document.createElement('aside')
    let second = document.createElement('aside')
    document.body.append(first, second)
    let { root, errors } = render(<Popup container={first} />)
    await settle()
    let owner = get('[aria-owns]')
    let id = owner.getAttribute('aria-owns')!
    let destination = get(`#${id}`)
    expect(destination.contains(get('#popup'))).toBe(true)
    expect(owner.hasAttribute('aria-hidden')).toBe(false)
    expect(owner.tabIndex).toBe(-1)
    root.render(<Popup container={second} changed />)
    root.flush()
    await settle()
    expect(get('[aria-owns]').getAttribute('aria-owns')).toBe(id)
    let replacement = get(`#${id}`)
    expect(replacement).not.toBe(destination)
    expect(destination.isConnected).toBe(false)
    expect(second.contains(replacement)).toBe(true)
    expect(document.querySelectorAll('[aria-owns]').length).toBe(1)
    root.render(<Popup container={second} open={false} />)
    root.flush()
    await settle()
    expect(document.querySelector('[aria-owns]')).toBe(null)
    root.render(<Popup container={second} />)
    root.flush()
    await settle()
    expect(get('[aria-owns]').getAttribute('aria-owns')).toBe(id)
    root.render(null)
    root.flush()
    expect(document.getElementById(id)).toBe(null)
    expect(document.querySelector('[aria-owns]')).toBe(null)
    expect(errors).toEqual([])
  })
  it('removes origin ownership and Tab stops when only the surface unmounts', async () => {
    let { root } = render(<Popup />)
    await settle()
    expect(document.querySelectorAll('[aria-owns]').length).toBe(1)
    root.render(<Popup mounted={false} />)
    root.flush()
    await settle()
    expect(document.querySelector('[aria-owns]')).toBe(null)
    let guards = Array.from(document.querySelectorAll<HTMLElement>('[data-rmx-focus-guard]'))
    expect(guards.every((node) => node.tabIndex === -1)).toBe(true)
    root.render(<Popup />)
    root.flush()
    await settle()
    expect(document.querySelectorAll('[aria-owns]').length).toBe(1)
  })
  it('does not leave closed popup guards in document navigation', async () => {
    let { root } = render(<Popup />)
    await settle()
    get('#last').focus()
    root.render(<Popup open={false} />)
    root.flush()
    await settle()
    let guards = Array.from(document.querySelectorAll<HTMLElement>('[data-rmx-focus-guard]'))
    expect(guards.every((node) => node.tabIndex === -1)).toBe(true)
  })
  it('does not add non-modal accessibility ownership to a modal dialog', async () => {
    render(
      <dialog.Context defaultOpen>
        <dialog.Portal>
          <dialog.SurfaceContext>
            <section aria-label="Dialog" mix={dialog.surface()}>
              <button>Action</button>
            </section>
          </dialog.SurfaceContext>
        </dialog.Portal>
      </dialog.Context>,
    )
    await settle()
    expect(document.querySelector('[aria-owns]')).toBe(null)
    expect(get('[role="dialog"]').getAttribute('aria-modal')).toBe('true')
  })
  it('keeps combobox accessibility on its input instead of adding an origin owner', async () => {
    render(
      <combobox.Context>
        <input aria-label="Combobox" mix={combobox.input()} />
        <combobox.Portal>
          <combobox.PopoverContext>
            <section mix={combobox.popover()}>
              <div mix={combobox.list()}>
                <div mix={combobox.option({ label: 'Option', value: 'option' })}>Option</div>
              </div>
            </section>
          </combobox.PopoverContext>
        </combobox.Portal>
      </combobox.Context>,
    )
    await settle()
    expect(document.querySelector('[aria-owns]')).toBe(null)
    let controlled = get('[role="combobox"]').getAttribute('aria-controls')!
    expect(document.getElementById(controlled)).toBe(get('[role="listbox"]'))
  })
  it('preserves authored tabindex changes and newly added controls', async () => {
    let { root, errors } = render(<Popup />)
    await settle()
    expect(get('#first').tabIndex).toBe(-1)
    root.render(<Popup changed />)
    root.flush()
    await settle()
    get('#last').focus()
    expect(get('#first').getAttribute('tabindex')).toBe('-1')
    expect(get('#last').getAttribute('tabindex')).toBe('0')
    expect(get('#added').getAttribute('tabindex')).toBe(null)
    expect(errors).toEqual([])
  })
  it('suppresses links that become navigable while focus is outside', async () => {
    render(<Popup />)
    await settle()
    let link = document.createElement('a')
    link.textContent = 'Link'
    get('#popup').append(link)
    await settle()
    link.href = '#target'
    await settle()
    expect(link.getAttribute('tabindex')).toBe('-1')
    get('#last').focus()
    expect(link.getAttribute('tabindex')).toBe(null)
  })
  it('suppresses dynamic shadow controls and restores their authored attributes', async () => {
    let { root } = render(<Popup />)
    await settle()
    let host = document.createElement('div')
    let shadow = host.attachShadow({ mode: 'open' })
    let link = document.createElement('a')
    link.textContent = 'Link'
    shadow.append(link)
    get('#popup').append(host)
    await settle()
    link.href = '#target'
    await settle()
    expect(link.getAttribute('tabindex')).toBe('-1')
    link.setAttribute('tabindex', '0')
    await settle()
    expect(link.getAttribute('tabindex')).toBe('-1')
    get('#last').focus()
    expect(link.getAttribute('tabindex')).toBe('0')
    get('#anchor').focus()
    await settle()
    let nestedHost = document.createElement('div')
    let nested = nestedHost.attachShadow({ mode: 'open' })
    let input = document.createElement('input')
    nested.append(input)
    shadow.append(nestedHost)
    await settle()
    expect(input.getAttribute('tabindex')).toBe('-1')
    root.render(null)
    root.flush()
    expect(link.getAttribute('tabindex')).toBe('0')
    expect(input.getAttribute('tabindex')).toBe(null)
  })
  it('emits no keyboard stops for unmounted server portal content', async () => {
    let html = await renderToString(
      <dialog.Context defaultOpen modal={false}>
        <dialog.Portal>
          <dialog.SurfaceContext>
            <section mix={dialog.surface()}>Content</section>
          </dialog.SurfaceContext>
        </dialog.Portal>
      </dialog.Context>,
    )
    expect(html.includes('Content')).toBe(false)
    expect(html.includes('tabindex="0"')).toBe(false)
    expect(html.includes('<template')).toBe(false)
  })
  it('requires the owning dialog context', (t) => {
    t.mock.method(console, 'error', () => {})
    let { errors } = render(<dialog.Portal />)
    expect(errors[0] instanceof Error && errors[0].message).toBe(
      'dialog.Portal requires a dialog.Context ancestor',
    )
  })
  it('requires the owning popover context', (t) => {
    t.mock.method(console, 'error', () => {})
    let { errors } = render(<popover.Portal />)
    expect(errors[0] instanceof Error && errors[0].message).toBe(
      'popover.Portal requires a popover.Context ancestor',
    )
  })
  it('requires the owning menu context', (t) => {
    t.mock.method(console, 'error', () => {})
    let { errors } = render(<menu.Portal />)
    expect(errors[0] instanceof Error && errors[0].message).toBe(
      'menu.Portal requires a menu.Context ancestor',
    )
  })
  it('requires the owning select context', (t) => {
    t.mock.method(console, 'error', () => {})
    let { errors } = render(<select.Portal />)
    expect(errors[0] instanceof Error && errors[0].message).toBe(
      'select.Portal requires a select.Context ancestor',
    )
  })
  it('requires the owning combobox context', (t) => {
    t.mock.method(console, 'error', () => {})
    let { errors } = render(<combobox.Portal />)
    expect(errors[0] instanceof Error && errors[0].message).toBe(
      'combobox.Portal requires a combobox.Context ancestor',
    )
  })
  it('rejects a shadow-tree destination whose accessibility ownership cannot reach its origin', async (t) => {
    t.mock.method(console, 'error', () => {})
    let host = document.createElement('div')
    let shadow = host.attachShadow({ mode: 'open' })
    let container = document.createElement('div')
    shadow.append(container)
    document.body.append(host)
    let { errors } = render(<Popup container={container} />)
    await settle()
    expect(
      errors.some(
        (error) =>
          error instanceof Error &&
          error.message ===
            'popover.Portal requires its declaration and container to be in the same document, outside shadow roots',
      ),
    ).toBe(true)
  })
})
