import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { Portal, createRoot, on, type Handle } from '@remix-run/component'
import * as dialog from './dialog.ts'
import * as popover from './popover.ts'
import * as toast from './toast.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function get(selector: string): HTMLElement {
  let node = document.querySelector<HTMLElement>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

function key(node: HTMLElement, key: string): void {
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

function Popup(handle: Handle<{ id: string }>) {
  let open = false
  return () => (
    <popover.Context>
      <button
        id={`${handle.props.id}-open`}
        mix={[
          popover.anchor({}),
          popover.focusOnHide(),
          on('click', () => {
            open = true
            void handle.update()
          }),
        ]}
      >
        Open popover
      </button>
      <Portal>
        <popover.SurfaceContext>
          <div
            id={handle.props.id}
            mix={popover.surface({
              open,
              onHide() {
                open = false
                void handle.update()
              },
            })}
          >
            <button id={`${handle.props.id}-target`} mix={popover.focusOnShow()}>
              Popover action
            </button>
          </div>
        </popover.SurfaceContext>
      </Portal>
    </popover.Context>
  )
}

function mount(options: { finalFocus?: dialog.DialogFocusTarget; modal?: boolean } = {}) {
  let manager = toast.createToastManager()
  let parent: dialog.DialogRef | undefined
  let child: dialog.DialogRef | undefined
  let showViewport = true
  let removeViewport = () => {}
  function Example(handle: Handle) {
    removeViewport = () => {
      showViewport = false
      void handle.update()
    }
    return () => (
      <>
        <button id="background">Background</button>
        <dialog.Context
          modal={options.modal}
          ref={(api) => {
            parent = api
          }}
        >
          <button id="open" mix={dialog.trigger()}>
            Open
          </button>
          <Portal>
            <div id="parent-backdrop" mix={dialog.backdrop()} />
            <dialog.SurfaceContext>
              <section
                id="parent"
                aria-label="Dialog"
                mix={dialog.surface({ finalFocus: options.finalFocus })}
              >
                <button
                  id="publish"
                  mix={on('click', () => {
                    manager.add({ id: 'action', title: 'Completed' })
                  })}
                >
                  Publish
                </button>
                <Popup id="parent-popup" />
                <dialog.Context
                  ref={(api) => {
                    child = api
                  }}
                >
                  <button id="child-open" mix={dialog.trigger()}>
                    Open child
                  </button>
                  <Portal>
                    <div mix={dialog.backdrop()} />
                    <dialog.SurfaceContext>
                      <section id="child" aria-label="Child" mix={dialog.surface()}>
                        <button id="child-action">Child action</button>
                        <Popup id="child-popup" />
                      </section>
                    </dialog.SurfaceContext>
                  </Portal>
                </dialog.Context>
                <button id="close" mix={dialog.close()}>
                  Close
                </button>
              </section>
            </dialog.SurfaceContext>
          </Portal>
        </dialog.Context>
        {showViewport ? (
          <Portal>
            <toast.Context manager={manager}>
              {(items) => (
                <section id="notifications" mix={toast.root({ label: 'Notifications' })}>
                  {items.map((item) => (
                    <toast.ItemContext key={item.id} value={item.id}>
                      <article mix={toast.item()}>
                        <h2 mix={toast.title()}>{item.title}</h2>
                        <button id="close-parent" mix={on('click', () => parent?.close())}>
                          Close dialog
                        </button>
                        <button id="dismiss" mix={toast.close()}>
                          Dismiss
                        </button>
                      </article>
                    </toast.ItemContext>
                  ))}
                </section>
              )}
            </toast.Context>
          </Portal>
        ) : null}
      </>
    )
  }
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  roots.push(root)
  root.render(<Example />)
  root.flush()
  return {
    root,
    manager,
    removeViewport() {
      removeViewport()
    },
    closeParent() {
      parent?.close()
    },
    closeChild() {
      child?.close()
    },
  }
}

afterEach(() => {
  for (let root of roots) root.dispose()
  roots = []
  document.body.innerHTML = ''
})

describe('Dialog and Toast', () => {
  it('allows notification focus and clicks while keeping background controls inert', async (t) => {
    let { root } = mount()
    get('#open').click()
    root.flush()
    get('#publish').focus()
    get('#publish').click()
    root.flush()
    await t.waitFor(() =>
      expect(get('#notifications').closest('[inert], [aria-hidden="true"]')).toBe(null),
    )
    expect(get('#background').closest('[inert]')).not.toBe(null)
    key(get('#publish'), 'F6')
    root.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#notifications')))
    key(get('#notifications'), 'F6')
    expect(document.activeElement).toBe(get('#publish'))
    get('#dismiss').click()
    root.flush()
    await t.waitFor(() => expect(get('#parent').hasAttribute('data-open')).toBe(true))
    get('#parent-backdrop').click()
    root.flush()
    await t.waitFor(() => expect(get('#parent').hasAttribute('data-open')).toBe(false))
  })

  it('dismisses only the focused toast on Escape and returns to the dialog', async (t) => {
    let { root, manager } = mount()
    get('#open').click()
    root.flush()
    get('#publish').focus()
    get('#publish').click()
    root.flush()
    key(get('#publish'), 'F6')
    root.flush()
    get('#dismiss').focus()
    key(get('#dismiss'), 'Escape')
    root.flush()
    await t.waitFor(() => expect(manager.items.length).toBe(0))
    expect(get('#parent').hasAttribute('data-open')).toBe(true)
    expect(document.activeElement).toBe(get('#publish'))
    key(get('#publish'), 'Escape')
    root.flush()
    await t.waitFor(() => expect(get('#parent').hasAttribute('data-open')).toBe(false))
  })

  it('lets a toast action dismiss a popover without dismissing its dialog', async (t) => {
    let { root, manager } = mount()
    get('#open').click()
    root.flush()
    get('#publish').click()
    root.flush()
    get('#parent-popup-open').click()
    root.flush()
    await t.waitFor(() => expect(get('#parent-popup').hasAttribute('data-open')).toBe(true))
    get('#dismiss').click()
    root.flush()
    await t.waitFor(() => expect(manager.items.length).toBe(0))
    expect(get('#parent-popup').hasAttribute('data-open')).toBe(false)
    expect(get('#parent').hasAttribute('data-open')).toBe(true)
  })

  it('consumes toast Escape while keeping a nested popover and its dialog open', async (t) => {
    let { root, manager } = mount()
    get('#open').click()
    root.flush()
    get('#publish').click()
    root.flush()
    get('#parent-popup-open').click()
    root.flush()
    key(get('#parent-popup-target'), 'F6')
    root.flush()
    get('#dismiss').focus()
    key(get('#dismiss'), 'Escape')
    root.flush()
    await t.waitFor(() => expect(manager.items.length).toBe(0))
    expect(get('#parent-popup').hasAttribute('data-open')).toBe(true)
    expect(get('#parent').hasAttribute('data-open')).toBe(true)
    expect(document.activeElement).toBe(get('#parent-popup-target'))
  })

  it('honors explicit final focus immediately when a notification is focused', async (t) => {
    let calls = 0
    let { root, closeParent } = mount({
      finalFocus: () => {
        calls++
        return get('#background')
      },
    })
    get('#open').click()
    root.flush()
    get('#publish').click()
    root.flush()
    key(get('#publish'), 'F6')
    root.flush()
    closeParent()
    root.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#background')))
    expect(calls).toBe(1)
  })

  it('does not restore standalone notification focus when its viewport unmounts', async (t) => {
    let { root, manager, removeViewport } = mount()
    manager.add({ title: 'Notification' })
    root.flush()
    get('#background').focus()
    key(get('#background'), 'F6')
    root.flush()
    removeViewport()
    root.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(document.body))
  })

  it('keeps nonmodal focus-departure dismissal when notifications receive focus', async (t) => {
    let { root } = mount({ modal: false })
    get('#open').click()
    root.flush()
    get('#publish').click()
    root.flush()
    get('#dismiss').focus()
    root.flush()
    await t.waitFor(() => expect(get('#parent').hasAttribute('data-open')).toBe(false))
    expect(document.activeElement).toBe(get('#dismiss'))
  })

  it('preserves toast focus across nested dialog closing and updates the return target', async (t) => {
    let { root, manager, closeChild, closeParent } = mount()
    get('#open').click()
    root.flush()
    get('#publish').click()
    root.flush()
    get('#child-open').focus()
    get('#child-open').click()
    root.flush()
    key(get('#child-action'), 'F6')
    root.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#notifications')))
    expect(get('#notifications').closest('[inert]')).toBe(null)
    closeChild()
    root.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#notifications')))
    key(get('#notifications'), 'F6')
    expect(document.activeElement).toBe(get('#child-open'))
    key(get('#child-open'), 'F6')
    root.flush()
    closeParent()
    root.flush()
    await t.waitFor(() => expect(manager.items.length).toBe(1))
    expect(document.activeElement).toBe(get('#notifications'))
    key(get('#notifications'), 'F6')
    expect(document.activeElement).toBe(get('#open'))
  })

  it('recovers dialog focus when the focused notification viewport unmounts', async (t) => {
    let { root, removeViewport } = mount()
    get('#open').click()
    root.flush()
    get('#publish').focus()
    get('#publish').click()
    root.flush()
    key(get('#publish'), 'F6')
    root.flush()
    removeViewport()
    root.flush()
    await t.waitFor(() => expect(document.querySelector('#notifications')).toBe(null))
    expect(document.activeElement).toBe(get('#publish'))
    expect(get('#background').closest('[inert]')).not.toBe(null)
  })

  it('returns to the dialog opener when notification focus came from a portaled popover', async (t) => {
    let { root, closeParent } = mount()
    get('#open').click()
    root.flush()
    get('#publish').click()
    root.flush()
    get('#parent-popup-open').click()
    root.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#parent-popup-target')))
    key(get('#parent-popup-target'), 'F6')
    root.flush()
    closeParent()
    root.flush()
    await t.waitFor(() => expect(get('#parent').hasAttribute('data-open')).toBe(false))
    expect(get('#parent-popup').hasAttribute('data-open')).toBe(false)
    expect(document.activeElement).toBe(get('#notifications'))
    key(get('#notifications'), 'F6')
    expect(document.activeElement).toBe(get('#open'))
  })

  it('updates a portaled popover return target across nested dialog closures', async (t) => {
    let { root, closeChild, closeParent } = mount()
    get('#open').click()
    root.flush()
    get('#publish').click()
    root.flush()
    get('#child-open').click()
    root.flush()
    get('#child-popup-open').click()
    root.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#child-popup-target')))
    key(get('#child-popup-target'), 'F6')
    root.flush()
    closeChild()
    root.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#notifications')))
    key(get('#notifications'), 'F6')
    expect(document.activeElement).toBe(get('#child-open'))
    key(get('#child-open'), 'F6')
    closeParent()
    root.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#notifications')))
    key(get('#notifications'), 'F6')
    expect(document.activeElement).toBe(get('#open'))
  })
  it('returns to the opener after a toast action closes its popup and dialog', async (t) => {
    let { root } = mount()
    get('#open').click()
    root.flush()
    get('#publish').click()
    root.flush()
    get('#parent-popup-open').click()
    root.flush()
    key(get('#parent-popup-target'), 'F6')
    root.flush()
    get('#close-parent').focus()
    get('#close-parent').click()
    root.flush()
    await t.waitFor(() => expect(get('#parent-popup').hasAttribute('data-open')).toBe(false))
    expect(get('#parent').hasAttribute('data-open')).toBe(false)
    expect(document.activeElement).toBe(get('#close-parent'))
    key(get('#close-parent'), 'F6')
    expect(document.activeElement).toBe(get('#open'))
  })
})
