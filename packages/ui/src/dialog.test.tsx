import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { Portal, createRoot, on, type Handle, type RemixNode } from '@remix-run/component'
import { renderToString } from '@remix-run/component/server'
import * as dialog from './dialog.ts'
import * as popover from './popover.ts'
import * as menu from './menu.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function render(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  roots.push(root)
  root.render(node)
  root.flush()
  return { container, root }
}

function get<element extends HTMLElement>(container: HTMLElement, selector: string) {
  let node = container.querySelector<element>(selector)
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

function Example(handle: Handle<dialog.DialogContextProps>) {
  return () => (
    <dialog.Context {...handle.props}>
      <button id="trigger" mix={dialog.trigger()}>
        Edit profile
      </button>
      <dialog.SurfaceContext>
        <div mix={dialog.surface()}>
          <h2 mix={dialog.title()}>Profile</h2>
          <p mix={dialog.description()}>Your public information.</p>
          <input id="name" aria-label="Name" />
          <button id="close" mix={dialog.close()}>
            Done
          </button>
        </div>
      </dialog.SurfaceContext>
    </dialog.Context>
  )
}

function NestedDepthDialog(
  handle: Handle<{
    child?: dialog.DialogContextProps
    grandchild?: dialog.DialogContextProps
    withChild?: boolean
    withChildSurface?: boolean
    popupOpen?: boolean
  }>,
) {
  return () => (
    <dialog.Context defaultOpen modal={false} closeOnOutsideClick={false}>
      <button id="depth-parent-trigger" mix={dialog.trigger()}>
        Open parent
      </button>
      <dialog.Portal>
        <div data-depth-parent-backdrop mix={dialog.backdrop()} />
        <dialog.SurfaceContext>
          <section data-depth-parent aria-label="Parent" mix={dialog.surface()}>
            <button id="depth-parent-close" mix={dialog.close()}>
              Close parent
            </button>
            <popover.Context>
              <button mix={popover.anchor({ placement: 'bottom-start' })}>Popup anchor</button>
              <popover.Portal>
                <popover.SurfaceContext>
                  <div
                    aria-label="Popup"
                    mix={popover.surface({ open: handle.props.popupOpen ?? false, onHide() {} })}
                  >
                    <button>Popup action</button>
                  </div>
                </popover.SurfaceContext>
              </popover.Portal>
            </popover.Context>
            {handle.props.withChild !== false && (
              <dialog.Context modal={false} closeOnOutsideClick={false} {...handle.props.child}>
                <button id="depth-child-trigger" mix={dialog.trigger()}>
                  Open child
                </button>
                <dialog.Portal>
                  <div data-depth-child-backdrop mix={dialog.backdrop()} />
                  <dialog.SurfaceContext>
                    {handle.props.withChildSurface !== false && (
                      <section data-depth-child aria-label="Child" mix={dialog.surface()}>
                        <button id="depth-child-close" mix={dialog.close()}>
                          Close child
                        </button>
                        <dialog.Context
                          modal={false}
                          closeOnOutsideClick={false}
                          {...handle.props.grandchild}
                        >
                          <button id="depth-grandchild-trigger" mix={dialog.trigger()}>
                            Open grandchild
                          </button>
                          <dialog.Portal>
                            <div data-depth-grandchild-backdrop mix={dialog.backdrop()} />
                            <dialog.SurfaceContext>
                              <section
                                data-depth-grandchild
                                aria-label="Grandchild"
                                mix={dialog.surface()}
                              >
                                <button id="depth-grandchild-close" mix={dialog.close()}>
                                  Close grandchild
                                </button>
                              </section>
                            </dialog.SurfaceContext>
                          </dialog.Portal>
                        </dialog.Context>
                      </section>
                    )}
                  </dialog.SurfaceContext>
                </dialog.Portal>
              </dialog.Context>
            )}
          </section>
        </dialog.SurfaceContext>
      </dialog.Portal>
    </dialog.Context>
  )
}

function DetachedPopup(handle: Handle<dialog.DialogContextProps>) {
  let open = false
  return () => (
    <popover.Context>
      <dialog.Context {...handle.props}>
        <button id="trigger" mix={dialog.trigger()}>
          Open dialog
        </button>
        <dialog.SurfaceContext>
          <div mix={dialog.surface()}>
            <button
              id="popup-trigger"
              mix={[
                popover.anchor({ placement: 'bottom-start' }),
                popover.focusOnHide(),
                on('click', () => {
                  open = true
                  void handle.update()
                }),
              ]}
            >
              Open popup
            </button>
          </div>
        </dialog.SurfaceContext>
        <popover.SurfaceContext>
          <div
            data-popup
            mix={popover.surface({
              open,
              onHide() {
                open = false
                void handle.update()
              },
            })}
          >
            <button id="popup-action" mix={popover.focusOnShow()}>
              Popup action
            </button>
          </div>
        </popover.SurfaceContext>
      </dialog.Context>
    </popover.Context>
  )
}

afterEach(() => {
  for (let root of roots) root.dispose()
  roots = []
  document.body.innerHTML = ''
})

describe('dialog', () => {
  it('shows a backdrop mounted in a later portal and releases it on close', async () => {
    let { root } = render(
      <dialog.Context defaultOpen>
        <Portal>
          <dialog.SurfaceContext>
            <div data-surface mix={dialog.surface()}>
              <button id="close-late" mix={dialog.close()}>
                Close
              </button>
            </div>
          </dialog.SurfaceContext>
        </Portal>
        <Portal>
          <div data-backdrop mix={dialog.backdrop()} />
        </Portal>
      </dialog.Context>,
    )
    await settle(root)
    let backdrop = get<HTMLElement>(document.body, '[data-backdrop]')
    let surface = get<HTMLElement>(document.body, '[data-surface]')
    expect(backdrop.hasAttribute('data-open')).toBe(true)
    expect(
      Number(getComputedStyle(backdrop).zIndex) < Number(getComputedStyle(surface).zIndex),
    ).toBe(true)
    get<HTMLButtonElement>(document.body, '#close-late').click()
    await settle(root)
    expect(backdrop.hasAttribute('data-open')).toBe(false)
  })

  it('keeps initially open portaled children above their parent for focus and Escape', async () => {
    let { root } = render(
      <dialog.Context defaultOpen>
        <Portal>
          <dialog.SurfaceContext>
            <div data-parent mix={dialog.surface()}>
              <button id="parent-action">Parent action</button>
              <dialog.Context defaultOpen>
                <Portal>
                  <div data-child-backdrop mix={dialog.backdrop()} />
                  <dialog.SurfaceContext>
                    <div data-child mix={dialog.surface()}>
                      <button id="child-action">Child action</button>
                    </div>
                  </dialog.SurfaceContext>
                </Portal>
              </dialog.Context>
            </div>
          </dialog.SurfaceContext>
        </Portal>
      </dialog.Context>,
    )
    await settle(root)
    let parent = get<HTMLElement>(document.body, '[data-parent]')
    let child = get<HTMLElement>(document.body, '[data-child]')
    let backdrop = get<HTMLElement>(document.body, '[data-child-backdrop]')
    expect(document.activeElement?.id).toBe('child-action')
    expect(Number(getComputedStyle(child).zIndex) > Number(getComputedStyle(backdrop).zIndex)).toBe(
      true,
    )
    expect(
      Number(getComputedStyle(backdrop).zIndex) > Number(getComputedStyle(parent).zIndex),
    ).toBe(true)
    child.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await settle(root)
    expect(child.hasAttribute('data-open')).toBe(false)
    expect(parent.hasAttribute('data-open')).toBe(true)
    root.render(null)
    await settle(root)
    expect(document.body.querySelector('[data-open]')).toBe(null)
    expect(document.body.querySelector('[inert]')).toBe(null)
  })

  it('renders an ordinary element outside the native top layer', async () => {
    let { container, root } = render(<Example defaultOpen />)
    await settle(root)
    let surface = get<HTMLElement>(container, '[role="dialog"]')
    expect(surface.hasAttribute('popover')).toBe(false)
    expect(surface.matches(':popover-open')).toBe(false)
    expect(surface.getClientRects().length > 0).toBe(true)
  })

  it('focuses a registered target and returns focus to the trigger that opened it', async () => {
    let { container, root } = render(
      <dialog.Context>
        <button id="first" mix={dialog.trigger()}>
          First
        </button>
        <button id="second" mix={dialog.trigger()}>
          Second
        </button>
        <dialog.SurfaceContext>
          <div mix={dialog.surface()}>
            <input id="unselected" />
            <input id="selected" mix={dialog.focusOnShow()} />
            <button id="close" mix={dialog.close()}>
              Close
            </button>
          </div>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    let second = get<HTMLButtonElement>(container, '#second')
    second.focus()
    second.click()
    await settle(root)
    expect(document.activeElement?.id).toBe('selected')
    get<HTMLButtonElement>(container, '#close').click()
    await settle(root)
    expect(document.activeElement?.id).toBe('second')
  })

  it('focuses the surface after touch opening to avoid opening a virtual keyboard', async () => {
    let { container, root } = render(<Example />)
    get(container, '#trigger').dispatchEvent(
      new PointerEvent('click', {
        bubbles: true,
        pointerType: 'touch',
      }),
    )
    await settle(root)
    expect(document.activeElement).toBe(get(container, '[role="dialog"]'))
  })

  it('uses an explicit focus return target even after the opener is removed', async () => {
    let api: dialog.DialogRef | undefined
    function RemovableTrigger(handle: Handle) {
      let visible = true
      return () => (
        <dialog.Context
          ref={(value) => {
            api = value
          }}
        >
          {visible ? (
            <button id="trigger" mix={dialog.trigger()}>
              Open
            </button>
          ) : null}
          <button id="return" mix={dialog.focusOnHide()}>
            Return here
          </button>
          <dialog.SurfaceContext>
            <div mix={dialog.surface()}>
              <button
                id="remove-trigger"
                mix={on('click', () => {
                  visible = false
                  void handle.update()
                })}
              >
                Remove opener
              </button>
            </div>
          </dialog.SurfaceContext>
        </dialog.Context>
      )
    }
    let { container, root } = render(<RemovableTrigger />)
    get<HTMLButtonElement>(container, '#trigger').click()
    await settle(root)
    get<HTMLButtonElement>(container, '#remove-trigger').click()
    await settle(root)
    api?.close()
    await settle(root)
    expect(document.activeElement?.id).toBe('return')
  })

  it('restores page scrolling when an open dialog is unmounted', async () => {
    let overflow = document.documentElement.style.overflow
    let { root } = render(<Example defaultOpen />)
    await settle(root)
    expect(document.documentElement.style.overflow).toBe('hidden')
    root.render(null)
    await settle(root)
    expect(document.documentElement.style.overflow).toBe(overflow)
    expect(document.querySelector('[data-open]')).toBe(null)
  })

  it('exposes open descendant depths across three initially open portaled dialogs', async (t) => {
    render(<NestedDepthDialog child={{ defaultOpen: true }} grandchild={{ defaultOpen: true }} />)
    await t.waitFor(() => {
      let parent = get(document.body, '[data-depth-parent]')
      let child = get(document.body, '[data-depth-child]')
      let grandchild = get(document.body, '[data-depth-grandchild]')
      expect(getComputedStyle(parent).getPropertyValue('--dialog-open-descendant-depth')).toBe('2')
      expect(getComputedStyle(child).getPropertyValue('--dialog-open-descendant-depth')).toBe('1')
      expect(getComputedStyle(grandchild).getPropertyValue('--dialog-open-descendant-depth')).toBe(
        '0',
      )
      expect(get(document.body, '[data-depth-parent-backdrop]').hasAttribute('data-nested')).toBe(
        false,
      )
      expect(get(document.body, '[data-depth-child-backdrop]').hasAttribute('data-nested')).toBe(
        true,
      )
      expect(
        get(document.body, '[data-depth-grandchild-backdrop]').hasAttribute('data-nested'),
      ).toBe(true)
      expect(parent.hasAttribute('data-child-dialog-open')).toBe(true)
      expect(child.hasAttribute('data-child-dialog-open')).toBe(true)
      expect(grandchild.hasAttribute('data-child-dialog-open')).toBe(false)
    })
  })

  it('updates open descendant depths when uncontrolled descendants close and reopen', async (t) => {
    let { root } = render(<NestedDepthDialog />)
    let parent = get(document.body, '[data-depth-parent]')
    let child = get(document.body, '[data-depth-child]')
    let grandchild = get(document.body, '[data-depth-grandchild]')
    get<HTMLButtonElement>(document.body, '#depth-child-trigger').click()
    root.flush()
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1'),
    )
    get<HTMLButtonElement>(document.body, '#depth-grandchild-trigger').click()
    root.flush()
    await t.waitFor(() => {
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('2')
      expect(child.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1')
    })
    get<HTMLButtonElement>(document.body, '#depth-grandchild-close').click()
    root.flush()
    await t.waitFor(() => {
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1')
      expect(child.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0')
    })
    get<HTMLButtonElement>(document.body, '#depth-child-close').click()
    root.flush()
    await t.waitFor(() => expect(parent.hasAttribute('data-child-dialog-open')).toBe(false))
    get<HTMLButtonElement>(document.body, '#depth-child-trigger').click()
    root.flush()
    await t.waitFor(() => {
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1')
      expect(child.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0')
      expect(grandchild.hasAttribute('data-open')).toBe(false)
      expect(child.hasAttribute('data-nested')).toBe(true)
      expect(grandchild.hasAttribute('data-nested')).toBe(true)
    })
    get<HTMLButtonElement>(document.body, '#depth-parent-close').click()
    root.flush()
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0'),
    )
    get<HTMLButtonElement>(document.body, '#depth-parent-trigger').click()
    root.flush()
    await t.waitFor(() => {
      expect(parent.hasAttribute('data-open')).toBe(true)
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0')
      expect(child.hasAttribute('data-open')).toBe(false)
    })
  })

  it('reflects controlled open state rather than an unaccepted opening request', async (t) => {
    let { root } = render(<NestedDepthDialog child={{ open: false }} />)
    let parent = get(document.body, '[data-depth-parent]')
    get<HTMLButtonElement>(document.body, '#depth-child-trigger').click()
    root.flush()
    expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0')
    root.render(<NestedDepthDialog child={{ open: true }} />)
    root.flush()
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1'),
    )
    root.render(<NestedDepthDialog child={{ open: false }} />)
    root.flush()
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0'),
    )
  })

  it('removes an open child from its parent descendant depth when its context or surface unmounts', async (t) => {
    let { root } = render(<NestedDepthDialog child={{ open: true }} grandchild={{ open: true }} />)
    let parent = get(document.body, '[data-depth-parent]')
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('2'),
    )
    root.render(<NestedDepthDialog withChild={false} />)
    root.flush()
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0'),
    )
    root.render(<NestedDepthDialog child={{ open: true }} withChildSurface={false} />)
    root.flush()
    expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0')
    root.render(<NestedDepthDialog child={{ open: true }} />)
    root.flush()
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1'),
    )
    root.render(<NestedDepthDialog child={{ open: true }} withChildSurface={false} />)
    root.flush()
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0'),
    )
  })

  it('keeps the parent descendant depth when dismissal is cancelled', async (t) => {
    let { root } = render(
      <NestedDepthDialog
        child={{
          defaultOpen: true,
          onOpenChange(open, event) {
            if (!open) event.preventDefault()
          },
        }}
      />,
    )
    let parent = get(document.body, '[data-depth-parent]')
    let child = get(document.body, '[data-depth-child]')
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1'),
    )
    get<HTMLButtonElement>(document.body, '#depth-child-close').click()
    root.flush()
    expect(child.getAttribute('data-state')).toBe('open')
    expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1')
  })

  it('moves the parent forward when child exit begins without interrupting the exit animation', async (t) => {
    let { root } = render(<NestedDepthDialog child={{ defaultOpen: true }} />)
    let parent = get(document.body, '[data-depth-parent]')
    let child = get(document.body, '[data-depth-child]')
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1'),
    )
    let animation = child.animate({ opacity: [1, 0] }, { duration: 1000 })
    animation.pause()
    t.after(() => animation.cancel())
    get<HTMLButtonElement>(document.body, '#depth-child-close').click()
    root.flush()
    await t.waitFor(() => {
      expect(child.getAttribute('data-state')).toBe('closed')
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('0')
    })
    expect(child.hasAttribute('data-open')).toBe(true)
    animation.finish()
    await t.waitFor(() => expect(child.hasAttribute('data-open')).toBe(false))
  })

  it('does not change open descendant depths for a popup or an unrelated dialog', async (t) => {
    let { root } = render(<NestedDepthDialog child={{ open: true }} />)
    let parent = get(document.body, '[data-depth-parent]')
    await t.waitFor(() =>
      expect(parent.style.getPropertyValue('--dialog-open-descendant-depth')).toBe('1'),
    )
    root.render(
      <>
        <NestedDepthDialog child={{ open: true }} popupOpen />
        <dialog.Context defaultOpen modal={false} closeOnOutsideClick={false}>
          <dialog.SurfaceContext>
            <section data-unrelated aria-label="Unrelated" mix={dialog.surface()}>
              <button>Action</button>
            </section>
          </dialog.SurfaceContext>
        </dialog.Context>
      </>,
    )
    root.flush()
    await t.waitFor(() =>
      expect(get(document.body, '[data-unrelated]').hasAttribute('data-open')).toBe(true),
    )
    expect(
      get(document.body, '[data-depth-parent]').style.getPropertyValue(
        '--dialog-open-descendant-depth',
      ),
    ).toBe('1')
    expect(
      get(document.body, '[data-depth-child]').style.getPropertyValue(
        '--dialog-open-descendant-depth',
      ),
    ).toBe('0')
    expect(
      get(document.body, '[data-unrelated]').style.getPropertyValue(
        '--dialog-open-descendant-depth',
      ),
    ).toBe('0')
  })

  it('keeps the parent modal and its scroll lock when a nested dialog closes', async () => {
    let { container, root } = render(
      <dialog.Context defaultOpen>
        <dialog.SurfaceContext>
          <div data-parent mix={dialog.surface()}>
            <dialog.Context>
              <button id="child-trigger" mix={dialog.trigger()}>
                Open child
              </button>
              <dialog.SurfaceContext>
                <div data-child mix={dialog.surface()}>
                  <button id="child-close" mix={dialog.close()}>
                    Close child
                  </button>
                </div>
              </dialog.SurfaceContext>
            </dialog.Context>
          </div>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    await settle(root)
    let trigger = get<HTMLButtonElement>(container, '#child-trigger')
    trigger.click()
    await settle(root)
    expect(document.querySelectorAll('[data-open]').length).toBe(2)
    get<HTMLButtonElement>(container, '#child-close').click()
    await settle(root)
    expect(get<HTMLElement>(container, '[data-parent]').matches('[data-open]')).toBe(true)
    expect(get<HTMLElement>(container, '[data-child]').matches('[data-open]')).toBe(false)
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.activeElement?.id).toBe('child-trigger')
  })

  it('handles Escape once and allows the owner to veto it', async () => {
    let changes: dialog.DialogChangeReason[] = []
    let { container, root } = render(
      <Example
        defaultOpen
        onOpenChange={(_open, event) => {
          changes.push(event.reason)
          event.preventDefault()
        }}
      />,
    )
    await settle(root)
    let surface = get<HTMLElement>(container, '[role="dialog"]')
    surface.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await settle(root)
    expect(changes).toEqual(['escape-key'])
    expect(surface.matches('[data-open]')).toBe(true)
  })

  it('disables Escape dismissal without disabling the close button', async () => {
    let { container, root } = render(<Example defaultOpen closeOnEscape={false} />)
    await settle(root)
    let surface = get<HTMLElement>(container, '[role="dialog"]')
    surface.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)
    get<HTMLButtonElement>(container, '#close').click()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
  })

  it('does not open from a disabled trigger or submit its surrounding form', async () => {
    let submissions = 0
    let { container, root } = render(
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          submissions++
        })}
      >
        <dialog.Context>
          <button id="disabled" disabled mix={dialog.trigger()}>
            Unavailable
          </button>
          <button id="enabled" mix={dialog.trigger()}>
            Open
          </button>
          <dialog.SurfaceContext>
            <div mix={dialog.surface()}>
              <button mix={dialog.close()}>Close</button>
            </div>
          </dialog.SurfaceContext>
        </dialog.Context>
      </form>,
    )
    get<HTMLButtonElement>(container, '#disabled').click()
    await settle(root)
    expect(get<HTMLElement>(container, '[role="dialog"]').matches('[data-open]')).toBe(false)
    get<HTMLButtonElement>(container, '#enabled').click()
    await settle(root)
    expect(get<HTMLElement>(container, '[role="dialog"]').matches('[data-open]')).toBe(true)
    expect(submissions).toBe(0)
  })

  it('removes label relationships when their parts are removed', async () => {
    function Labels(handle: Handle) {
      let visible = true
      return () => (
        <dialog.Context defaultOpen>
          <dialog.SurfaceContext>
            <div mix={dialog.surface()}>
              {visible ? (
                <>
                  <h2 mix={dialog.title()}>Title</h2>
                  <p mix={dialog.description()}>Description</p>
                </>
              ) : null}
              <button
                id="remove-labels"
                mix={on('click', () => {
                  visible = false
                  void handle.update()
                })}
              >
                Remove
              </button>
            </div>
          </dialog.SurfaceContext>
        </dialog.Context>
      )
    }
    let { container, root } = render(<Labels />)
    await settle(root)
    let surface = get<HTMLElement>(container, '[role="dialog"]')
    get<HTMLButtonElement>(container, '#remove-labels').click()
    await settle(root)
    expect(surface.hasAttribute('aria-labelledby')).toBe(false)
    expect(surface.hasAttribute('aria-describedby')).toBe(false)
  })

  it('opens a modal, links its labels, and closes from the close button', async () => {
    let { container, root } = render(<Example />)
    let trigger = get<HTMLButtonElement>(container, '#trigger')
    let surface = get<HTMLElement>(container, '[role="dialog"]')
    expect(surface.matches('[data-open]')).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    trigger.click()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)
    expect(trigger.getAttribute('aria-controls')).toBe(surface.id)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(surface.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Profile',
    )
    expect(document.getElementById(surface.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Your public information.',
    )
    get<HTMLButtonElement>(container, '#close').click()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps a controlled dialog open until its owner accepts a close request', async () => {
    let requests: boolean[] = []
    let acceptClose = () => {}
    function Controlled(handle: Handle) {
      let open = true
      acceptClose = () => {
        open = false
        void handle.update()
      }
      return () => (
        <>
          <Example open={open} onOpenChange={(next) => requests.push(next)} />
        </>
      )
    }
    let { container, root } = render(<Controlled />)
    await settle(root)
    let surface = get<HTMLElement>(container, '[role="dialog"]')
    get<HTMLButtonElement>(container, '#close').click()
    await settle(root)
    expect(requests).toEqual([false])
    expect(surface.matches('[data-open]')).toBe(true)
    acceptClose()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
  })

  it('allows non-modal focus and pointer interaction without locking the page', async () => {
    let overflow = document.documentElement.style.overflow
    let { container, root } = render(
      <>
        <button id="outside">Outside</button>
        <Example defaultOpen modal={false} closeOnOutsideClick={false} />
      </>,
    )
    await settle(root)
    let outside = get<HTMLButtonElement>(container, '#outside')
    outside.focus()
    expect(document.activeElement).toBe(outside)
    expect(outside.closest('[inert]')).toBe(null)
    expect(document.documentElement.style.overflow).toBe(overflow)
    expect(get(container, '[role="dialog"]').hasAttribute('aria-modal')).toBe(false)
  })

  it('closes a non-modal dialog when focus leaves without stealing focus back', async () => {
    let { container, root } = render(
      <>
        <button id="outside">Outside</button>
        <Example defaultOpen modal={false} />
      </>,
    )
    await settle(root)
    let outside = get<HTMLButtonElement>(container, '#outside')
    outside.focus()
    await settle(root)
    expect(get(container, '[role="dialog"]').matches('[data-open]')).toBe(false)
    expect(document.activeElement).toBe(outside)
  })

  it('traps focus without blocking background pointers or page scrolling', async () => {
    let overflow = document.documentElement.style.overflow
    let { container, root } = render(
      <>
        <button id="outside">Outside</button>
        <Example defaultOpen modal="trap-focus" closeOnOutsideClick={false} />
      </>,
    )
    await settle(root)
    let outside = get<HTMLButtonElement>(container, '#outside')
    expect(outside.closest('[inert]')).toBe(null)
    expect(document.documentElement.style.overflow).toBe(overflow)
    outside.focus()
    expect(get(container, '[role="dialog"]').contains(document.activeElement)).toBe(true)
  })

  it('preserves the outside focus target when a trigger-opened non-modal dialog loses focus', async () => {
    let { container, root } = render(
      <>
        <button id="outside">Outside</button>
        <Example modal={false} />
      </>,
    )
    get<HTMLButtonElement>(container, '#trigger').click()
    await settle(root)
    let outside = get<HTMLButtonElement>(container, '#outside')
    outside.focus()
    await settle(root)
    expect(get(container, '[role="dialog"]').matches('[data-open]')).toBe(false)
    expect(document.activeElement).toBe(outside)
  })

  it('changes modal behavior while open without losing the original focus return target', async () => {
    let api: dialog.DialogRef | undefined
    let setModal = (_modal: dialog.DialogModal) => {}
    function Modes(handle: Handle) {
      let modal: dialog.DialogModal = true
      setModal = (value) => {
        modal = value
        void handle.update()
      }
      return () => (
        <Example
          modal={modal}
          closeOnOutsideClick={false}
          ref={(value) => {
            api = value
          }}
        />
      )
    }
    let { container, root } = render(
      <>
        <button id="outside">Outside</button>
        <Modes />
      </>,
    )
    await settle(root)
    let outside = get<HTMLButtonElement>(container, '#outside')
    outside.focus()
    api?.show()
    await settle(root)
    expect(outside.closest('[inert]')).not.toBe(null)
    setModal(false)
    await settle(root)
    expect(outside.closest('[inert]')).toBe(null)
    expect(get(container, '[role="dialog"]').hasAttribute('aria-modal')).toBe(false)
    setModal('trap-focus')
    await settle(root)
    outside.focus()
    expect(get(container, '[role="dialog"]').contains(document.activeElement)).toBe(true)
    api?.close()
    await settle(root)
    expect(document.activeElement).toBe(outside)
  })

  it('keeps the dialog open when Escape and outside dismissal are disabled', async () => {
    let { container, root } = render(
      <Example defaultOpen closeOnEscape={false} closeOnOutsideClick={false} />,
    )
    await settle(root)
    let surface = get(container, '[role="dialog"]')
    surface.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)
    get<HTMLButtonElement>(container, '#close').click()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
  })

  it('supports alert dialogs and explicit accessible labels', async () => {
    let { container, root } = render(
      <dialog.Context defaultOpen>
        <dialog.SurfaceContext>
          <div
            role="alertdialog"
            aria-label="Confirm deletion"
            aria-describedby="custom-description"
            mix={dialog.surface()}
          >
            <h2 mix={dialog.title()}>Delete</h2>
            <p id="custom-description">This cannot be undone.</p>
            <button mix={dialog.close()}>Cancel</button>
          </div>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    await settle(root)
    let surface = get(container, '[role="alertdialog"]')
    expect(surface.getAttribute('aria-label')).toBe('Confirm deletion')
    expect(surface.hasAttribute('aria-labelledby')).toBe(false)
    expect(surface.getAttribute('aria-describedby')).toBe('custom-description')
  })

  it('does not move focus when initialFocus is false, including on autofocus content', async () => {
    let { container, root } = render(
      <dialog.Context modal={false}>
        <button id="trigger" mix={dialog.trigger()}>
          Open
        </button>
        <dialog.SurfaceContext>
          <div mix={dialog.surface({ initialFocus: false })}>
            <input autofocus id="autofocus" />
          </div>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    await settle(root)
    let trigger = get<HTMLButtonElement>(container, '#trigger')
    trigger.focus()
    trigger.click()
    await settle(root)
    expect(document.activeElement?.id).toBe('trigger')
    expect(get(container, '#autofocus').hasAttribute('autofocus')).toBe(true)
  })

  it('restores prior focus after imperative opening with native autofocus content', async () => {
    let api: dialog.DialogRef | undefined
    let { container, root } = render(
      <>
        <button id="outside">Outside</button>
        <dialog.Context
          ref={(value) => {
            api = value
          }}
        >
          <dialog.SurfaceContext>
            <div mix={dialog.surface()}>
              <input autofocus id="autofocus" />
            </div>
          </dialog.SurfaceContext>
        </dialog.Context>
      </>,
    )
    await settle(root)
    let outside = get<HTMLButtonElement>(container, '#outside')
    outside.focus()
    api?.show()
    await settle(root)
    expect(document.activeElement?.id).toBe('autofocus')
    api?.close()
    await settle(root)
    expect(document.activeElement).toBe(outside)
  })

  it('can suppress both initial focus and focus restoration', async () => {
    let api: dialog.DialogRef | undefined
    let { container, root } = render(
      <dialog.Context
        modal={false}
        ref={(value) => {
          api = value
        }}
      >
        <button id="trigger" mix={dialog.trigger()}>
          Open
        </button>
        <dialog.SurfaceContext>
          <div mix={dialog.surface({ initialFocus: false, finalFocus: false })}>
            <button id="inside">Inside</button>
          </div>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    let trigger = get<HTMLButtonElement>(container, '#trigger')
    trigger.focus()
    trigger.click()
    await settle(root)
    expect(document.activeElement).toBe(trigger)
    get<HTMLElement>(container, '#inside').focus()
    api?.close()
    await settle(root)
    expect(document.activeElement).not.toBe(trigger)
  })
  it('wraps actual guard crossings while skipping disabled, hidden and unchecked controls', async () => {
    let { container, root } = render(
      <dialog.Context defaultOpen>
        <dialog.SurfaceContext>
          <div aria-label="Dialog" mix={dialog.surface()}>
            <fieldset disabled>
              <input />
            </fieldset>
            <button hidden>Hidden</button>
            <input type="radio" name="guard-choice" />
            <input id="selected" type="radio" name="guard-choice" defaultChecked />
            <button id="last">Last</button>
          </div>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    await settle(root)
    let guards = container.querySelectorAll<HTMLElement>('[data-rmx-focus-guard]')
    expect(guards.length).toBe(2)
    get(container, '#selected').focus()
    guards[0].focus()
    expect(document.activeElement).toBe(get(container, '#last'))
    guards[1].focus()
    expect(document.activeElement).toBe(get(container, '#selected'))
  })

  it('includes shadow-root controls when wrapping an actual guard crossing', async () => {
    let { container, root } = render(
      <dialog.Context defaultOpen>
        <dialog.SurfaceContext>
          <div aria-label="Dialog" mix={dialog.surface()}>
            <div id="host" />
            <button id="last">Last</button>
          </div>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    await settle(root)
    let shadow = get(container, '#host').attachShadow({ mode: 'open' })
    let control = document.createElement('button')
    control.textContent = 'Shadow control'
    shadow.append(control)
    let guards = container.querySelectorAll<HTMLElement>('[data-rmx-focus-guard]')
    expect(guards.length).toBe(2)
    control.focus()
    guards[0].focus()
    expect(document.activeElement).toBe(get(container, '#last'))
    guards[1].focus()
    expect(shadow.activeElement).toBe(control)
  })

  it('waits for exit animations and ignores a superseded close when reopened', async () => {
    let api: dialog.DialogRef | undefined
    let completed: boolean[] = []
    let { container, root } = render(
      <Example
        defaultOpen
        ref={(value) => {
          api = value
        }}
        onOpenChangeComplete={(value) => completed.push(value)}
      />,
    )
    await settle(root)
    let surface = get<HTMLElement>(container, '[role="dialog"]')
    let animation = surface.animate({ opacity: [1, 0] }, { duration: 1000 })
    animation.pause()
    api?.close()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)
    expect(surface.getAttribute('data-state')).toBe('closed')
    api?.show()
    await settle(root)
    animation.finish()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)
    expect(completed).toEqual([true, true])
    api?.close()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
    expect(completed).toEqual([true, true, false])
  })

  it('does not wait for infinite decorative animations when closing', async () => {
    let api: dialog.DialogRef | undefined
    let { container, root } = render(
      <Example
        defaultOpen
        ref={(value) => {
          api = value
        }}
      />,
    )
    await settle(root)
    let surface = get(container, '[role="dialog"]')
    let animation = surface.animate({ opacity: [0.9, 1] }, { duration: 1000, iterations: Infinity })
    api?.close()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
    animation.cancel()
  })

  it('retains keyed content and guard boundaries through updates and surface replacement', async () => {
    function ChangingSurface(handle: Handle<{ items: string[]; visible: boolean }>) {
      return () => (
        <dialog.Context defaultOpen>
          <dialog.SurfaceContext>
            {handle.props.visible ? (
              <section aria-label="Dialog" mix={dialog.surface()}>
                {handle.props.items.map((id) => (
                  <button key={id} id={id}>
                    {id}
                  </button>
                ))}
              </section>
            ) : null}
          </dialog.SurfaceContext>
        </dialog.Context>
      )
    }
    let { container, root } = render(<ChangingSurface items={['first', 'last']} visible />)
    await settle(root)
    let first = get(container, '#first')
    let guards = Array.from(container.querySelectorAll<HTMLElement>('[data-rmx-focus-guard]'))
    expect(guards.length).toBe(2)
    expect(guards.every((node) => node.tabIndex === 0)).toBe(true)
    root.render(<ChangingSurface items={['last', 'first']} visible />)
    await settle(root)
    expect(get(container, '#first')).toBe(first)
    expect(Array.from(container.querySelectorAll('[data-rmx-focus-guard]'))).toEqual(guards)
    root.render(<ChangingSurface items={[]} visible={false} />)
    await settle(root)
    expect(guards.every((node) => node.tabIndex === -1)).toBe(true)
    expect(document.body.querySelector('[inert]')).toBe(null)
    root.render(<ChangingSurface items={['replacement']} visible />)
    await settle(root)
    expect(guards.every((node) => node.tabIndex === 0)).toBe(true)
    expect(document.activeElement).toBe(get(container, '#replacement'))
  })

  it('closes nested dialogs and restores outside focus when their parent closes', async () => {
    let parent: dialog.DialogRef | undefined
    let { container, root } = render(
      <dialog.Context
        ref={(value) => {
          parent = value
        }}
      >
        <button id="parent-trigger" mix={dialog.trigger()}>
          Open
        </button>
        <dialog.SurfaceContext>
          <div data-parent mix={dialog.surface()}>
            <dialog.Context>
              <button id="child-trigger" mix={dialog.trigger()}>
                Open child
              </button>
              <dialog.SurfaceContext>
                <div data-child mix={dialog.surface()}>
                  <button>Child action</button>
                </div>
              </dialog.SurfaceContext>
            </dialog.Context>
          </div>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    get<HTMLButtonElement>(container, '#parent-trigger').click()
    await settle(root)
    get<HTMLButtonElement>(container, '#child-trigger').click()
    await settle(root)
    parent?.close()
    await settle(root)
    expect(container.querySelectorAll('[data-open]').length).toBe(0)
    expect(document.activeElement?.id).toBe('parent-trigger')
  })

  it('closes nested popovers and releases their scroll lock when the parent closes', async () => {
    let api: dialog.DialogRef | undefined
    let overflow = document.documentElement.style.overflow
    function NestedPopover(handle: Handle) {
      let open = false
      return () => (
        <dialog.Context
          ref={(value) => {
            api = value
          }}
        >
          <button id="trigger" mix={dialog.trigger()}>
            Open dialog
          </button>
          <dialog.SurfaceContext>
            <div mix={dialog.surface()}>
              <popover.Context>
                <button
                  id="popup-trigger"
                  mix={[
                    popover.anchor({ placement: 'bottom-start' }),
                    on('click', () => {
                      open = true
                      void handle.update()
                    }),
                  ]}
                >
                  Open popup
                </button>
                <popover.SurfaceContext>
                  <div
                    data-popup
                    mix={popover.surface({
                      open,
                      onHide() {
                        open = false
                        void handle.update()
                      },
                    })}
                  >
                    <button>Popup action</button>
                  </div>
                </popover.SurfaceContext>
              </popover.Context>
            </div>
          </dialog.SurfaceContext>
        </dialog.Context>
      )
    }
    let { container, root } = render(<NestedPopover />)
    get<HTMLButtonElement>(container, '#trigger').click()
    await settle(root)
    get<HTMLButtonElement>(container, '#popup-trigger').click()
    await settle(root)
    expect(get(container, '[data-popup]').matches('[data-open]')).toBe(true)
    api?.close()
    await settle(root)
    expect(container.querySelectorAll('[data-open]').length).toBe(0)
    expect(document.documentElement.style.overflow).toBe(overflow)
    api?.show()
    await settle(root)
    expect(get(container, '[data-popup]').matches('[data-open]')).toBe(false)
  })

  it('keeps a detached popup in the dialog focus boundary and closes it with its owner', async () => {
    let api: dialog.DialogRef | undefined
    let overflow = document.documentElement.style.overflow
    let { container, root } = render(
      <DetachedPopup
        ref={(value) => {
          api = value
        }}
      />,
    )
    get<HTMLButtonElement>(container, '#trigger').click()
    await settle(root)
    get<HTMLButtonElement>(container, '#popup-trigger').click()
    await settle(root)
    expect(document.activeElement?.id).toBe('popup-action')
    expect(get(container, '[data-popup]').closest('[inert], [aria-hidden="true"]')).toBe(null)
    api?.close()
    await settle(root)
    expect(container.querySelectorAll('[data-open]').length).toBe(0)
    expect(document.documentElement.style.overflow).toBe(overflow)
    expect(document.activeElement?.id).toBe('trigger')
  })

  it('releases a removed portaled popup while keeping its modal active', async () => {
    function RemovablePopup(handle: Handle<{ visible: boolean }>) {
      return () => (
        <popover.Context>
          <dialog.Context defaultOpen>
            <dialog.SurfaceContext>
              <section aria-label="Dialog" mix={dialog.surface()}>
                <button id="anchor" mix={popover.anchor({})}>
                  Anchor
                </button>
              </section>
            </dialog.SurfaceContext>
            {handle.props.visible ? (
              <Portal>
                <popover.SurfaceContext>
                  <div data-popup mix={popover.surface({ open: true, onHide() {} })}>
                    <input id="popup-input" mix={popover.focusOnShow()} />
                  </div>
                </popover.SurfaceContext>
              </Portal>
            ) : null}
          </dialog.Context>
        </popover.Context>
      )
    }
    let { container, root } = render(<RemovablePopup visible />)
    await settle(root)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    get(document.body, '#popup-input').focus()
    root.render(<RemovablePopup visible={false} />)
    await settle(root)
    expect(document.querySelector('[data-popup]')).toBe(null)
    expect(errors).toEqual([])
    let surface = get(container, '[role="dialog"]')
    expect(surface.hasAttribute('data-open')).toBe(true)
    expect(surface.contains(document.activeElement)).toBe(true)
    expect(document.documentElement.style.overflow).toBe('hidden')
  })

  it('keeps a nonmodal dialog open while focus moves into its detached popup', async () => {
    let { container, root } = render(
      <>
        <button id="outside">Outside</button>
        <DetachedPopup modal={false} />
      </>,
    )
    get<HTMLButtonElement>(container, '#trigger').click()
    await settle(root)
    get<HTMLButtonElement>(container, '#popup-trigger').click()
    await settle(root)
    expect(get(container, '[role="dialog"]').matches('[data-open]')).toBe(true)
    expect(document.activeElement?.id).toBe('popup-action')
    get(container, '#outside').focus()
    await settle(root)
    expect(container.querySelectorAll('[data-open]').length).toBe(0)
    expect(document.activeElement?.id).toBe('outside')
  })

  it('owns a detached context menu positioned at the pointer', async () => {
    let api: dialog.DialogRef | undefined
    let { container, root } = render(
      <menu.Context label="Actions">
        <dialog.Context
          defaultOpen
          ref={(value) => {
            api = value
          }}
        >
          <dialog.SurfaceContext>
            <div mix={dialog.surface()}>
              <button id="context-trigger" mix={menu.contextTrigger()}>
                Open actions
              </button>
            </div>
          </dialog.SurfaceContext>
          <menu.PopoverContext>
            <div data-menu mix={menu.popover()}>
              <div id="context-list" mix={menu.list()}>
                <button mix={menu.item({ name: 'archive' })}>Archive</button>
              </div>
            </div>
          </menu.PopoverContext>
        </dialog.Context>
      </menu.Context>,
    )
    await settle(root)
    get(container, '#context-trigger').dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
        cancelable: true,
      }),
    )
    await settle(root)
    expect(get(container, '[data-menu]').closest('[inert], [aria-hidden="true"]')).toBe(null)
    expect(document.activeElement?.id).toBe('context-list')
    api?.close()
    await settle(root)
    expect(container.querySelectorAll('[data-open]').length).toBe(0)
  })

  it('leaves menu Tab navigation to the browser while closing the menu', async () => {
    let { container, root } = render(
      <dialog.Context defaultOpen>
        <dialog.SurfaceContext>
          <div mix={dialog.surface()}>
            <input id="first" />
            <menu.Context label="Actions">
              <button id="menu-trigger" mix={menu.trigger()}>
                Actions
              </button>
              <menu.PopoverContext>
                <div mix={menu.popover()}>
                  <div id="menu-list" mix={menu.list()}>
                    <button mix={menu.item({ name: 'archive' })}>Archive</button>
                  </div>
                </div>
              </menu.PopoverContext>
            </menu.Context>
          </div>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    await settle(root)
    get<HTMLButtonElement>(container, '#menu-trigger').click()
    await settle(root)
    let event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    get(container, '#menu-list').dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    await settle(root)
    expect(get(container, '[data-popover]').hasAttribute('data-open')).toBe(false)
    expect(get(container, '[role="dialog"]').hasAttribute('data-open')).toBe(true)
  })

  it('releases a dialog when its containing popover closes', async () => {
    let api: dialog.DialogRef | undefined
    let closePopover = () => {}
    let overflow = document.documentElement.style.overflow
    function DialogInPopover(handle: Handle) {
      let open = true
      closePopover = () => {
        open = false
        void handle.update()
      }
      return () => (
        <popover.Context>
          <button mix={popover.anchor({ placement: 'bottom-start' })}>Popover opener</button>
          <popover.SurfaceContext>
            <div data-parent mix={popover.surface({ open, onHide: closePopover })}>
              <dialog.Context
                ref={(value) => {
                  api = value
                }}
              >
                <button id="trigger" mix={dialog.trigger()}>
                  Open dialog
                </button>
                <div mix={dialog.backdrop()} />
                <dialog.SurfaceContext>
                  <div mix={dialog.surface()}>
                    <button mix={dialog.close()}>Close</button>
                  </div>
                </dialog.SurfaceContext>
              </dialog.Context>
            </div>
          </popover.SurfaceContext>
        </popover.Context>
      )
    }
    let { container, root } = render(<DialogInPopover />)
    await settle(root)
    get<HTMLButtonElement>(container, '#trigger').click()
    await settle(root)
    closePopover()
    await settle(root)
    expect(container.querySelectorAll('[data-open]').length).toBe(0)
    expect(document.documentElement.style.overflow).toBe(overflow)
    expect(api?.open).toBe(false)
  })

  it('releases a controlled dialog even when its owner refuses an ancestor-close request', async () => {
    let closePopover = () => {}
    let rerender = () => {}
    let overflow = document.documentElement.style.overflow
    function ControlledInPopover(handle: Handle) {
      let open = true
      closePopover = () => {
        open = false
        void handle.update()
      }
      rerender = () => {
        void handle.update()
      }
      return () => (
        <popover.Context>
          <button mix={popover.anchor({ placement: 'bottom-start' })}>Popover opener</button>
          <popover.SurfaceContext>
            <div mix={popover.surface({ open, onHide: closePopover })}>
              <dialog.Context open onOpenChange={(_open, event) => event.preventDefault()}>
                <div mix={dialog.backdrop()} />
                <dialog.SurfaceContext>
                  <div mix={dialog.surface()}>
                    <button>Inside</button>
                  </div>
                </dialog.SurfaceContext>
              </dialog.Context>
            </div>
          </popover.SurfaceContext>
        </popover.Context>
      )
    }
    let { container, root } = render(<ControlledInPopover />)
    await settle(root)
    closePopover()
    await settle(root)
    rerender()
    await settle(root)
    expect(container.querySelectorAll('[data-open]').length).toBe(0)
    expect(document.documentElement.style.overflow).toBe(overflow)
    expect(container.querySelector('[inert]')).toBe(null)
  })

  it('allows canceling an open request through the public event', async () => {
    let reasons: dialog.DialogChangeReason[] = []
    let { container, root } = render(
      <div
        mix={dialog.onDialogChange((event) => {
          reasons.push(event.reason)
          event.preventDefault()
        })}
      >
        <Example />
      </div>,
    )
    get<HTMLButtonElement>(container, '#trigger').click()
    await settle(root)
    expect(reasons).toEqual(['trigger'])
    expect(get<HTMLElement>(container, '[role="dialog"]').matches('[data-open]')).toBe(false)
  })

  it('requires a surface context for declarative focus boundaries', (t) => {
    t.mock.method(console, 'error', () => {})
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    roots.push(root)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    root.render(
      <dialog.Context>
        <section mix={dialog.surface()} />
      </dialog.Context>,
    )
    root.flush()
    expect(errors.length).toBe(1)
    expect(errors[0] instanceof Error && errors[0].message).toBe(
      'dialog.surface() requires a dialog.SurfaceContext ancestor',
    )
  })

  it('requires the surface context at the portal destination', async (t) => {
    t.mock.method(console, 'error', () => {})
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    roots.push(root)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    root.render(
      <dialog.Context>
        <dialog.SurfaceContext>
          <Portal>
            <section mix={dialog.surface()} />
          </Portal>
        </dialog.SurfaceContext>
      </dialog.Context>,
    )
    await settle(root)
    expect(errors.length).toBe(1)
    expect(errors[0] instanceof Error && errors[0].message).toBe(
      'SurfaceContext must wrap its surface at the DOM destination. Place it inside Portal.',
    )
  })

  it('renders closed, accessible markup on the server even with defaultOpen', async () => {
    let html = await renderToString(<Example defaultOpen />)
    let template = document.createElement('template')
    template.innerHTML = html
    let surface = template.content.querySelector('[role="dialog"]')!
    expect(surface.hasAttribute('open')).toBe(false)
    expect(surface.getAttribute('aria-labelledby')).toBe(template.content.querySelector('h2')?.id)
    expect(surface.getAttribute('aria-describedby')).toBe(template.content.querySelector('p')?.id)
    expect(html.includes('Profile')).toBe(true)
  })
})
