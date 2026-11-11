import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'
import { renderToString } from '@remix-run/component/server'
import * as dialog from './dialog.ts'
import { Portal } from './portal.tsx'
import * as popover from './popover.ts'
import * as menu from './menu.tsx'
import { press } from './press.ts'
import { mouseClick, pointer } from './test/pointer.ts'

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
      <div mix={dialog.surface()}>
        <h2 mix={dialog.title()}>Profile</h2>
        <p mix={dialog.description()}>Your public information.</p>
        <input id="name" aria-label="Name" />
        <button id="close" mix={dialog.close()}>
          Done
        </button>
      </div>
    </dialog.Context>
  )
}

// The example with its trigger and close button opted into press.
function PressExample(handle: Handle<dialog.DialogContextProps>) {
  return () => (
    <dialog.Context {...handle.props}>
      <button id="trigger" mix={[dialog.trigger(), press()]}>
        Edit profile
      </button>
      <div mix={dialog.surface()}>
        <h2 mix={dialog.title()}>Profile</h2>
        <p mix={dialog.description()}>Your public information.</p>
        <input id="name" aria-label="Name" />
        <button id="close" mix={[dialog.close(), press()]}>
          Done
        </button>
      </div>
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
          <div data-surface mix={dialog.surface()}>
            <button id="close-late" mix={dialog.close()}>
              Close
            </button>
          </div>
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
          <div data-parent mix={dialog.surface()}>
            <button id="parent-action">Parent action</button>
            <dialog.Context defaultOpen>
              <Portal>
                <div data-child-backdrop mix={dialog.backdrop()} />
                <div data-child mix={dialog.surface()}>
                  <button id="child-action">Child action</button>
                </div>
              </Portal>
            </dialog.Context>
          </div>
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
        <div mix={dialog.surface()}>
          <input id="unselected" />
          <input id="selected" mix={dialog.focusOnShow()} />
          <button id="close" mix={dialog.close()}>
            Close
          </button>
        </div>
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

  it('opens and closes on click, not on mouse press', async () => {
    let { container, root } = render(<Example />)
    let trigger = get<HTMLButtonElement>(container, '#trigger')
    let surface = get<HTMLElement>(container, '[role="dialog"]')

    pointer(trigger, 'pointerdown')
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)

    pointer(trigger, 'pointerup')
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)

    let close = get(container, '#close')
    pointer(close, 'pointerdown')
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)
    mouseClick(close)
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps a mouse press on the trigger and close button from taking focus back', async () => {
    let { container } = render(<Example />)

    for (let id of ['#trigger', '#close']) {
      expect(pointer(get(container, id), 'pointerdown').defaultPrevented).toBe(true)
      expect(
        pointer(get(container, id), 'pointerdown', { pointerType: 'touch' }).defaultPrevented,
      ).toBe(false)
      expect(pointer(get(container, id), 'pointerdown', { button: 2 }).defaultPrevented).toBe(false)
    }
  })

  it('opens and closes on mouse press with press(), without the release dismissing it', async () => {
    let { container, root } = render(<PressExample />)
    let trigger = get<HTMLButtonElement>(container, '#trigger')
    let surface = get<HTMLElement>(container, '[role="dialog"]')

    pointer(trigger, 'pointerdown')
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)
    expect(document.activeElement?.id).toBe('name')

    // A backdrop under the pointer retargets the release, so the click lands on a common ancestor.
    pointer(document.body, 'pointerup')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)

    pointer(get(container, '#close'), 'pointerdown')
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
    expect(document.activeElement).toBe(trigger)

    // The click that trails the press neither reopens nor toggles anything.
    pointer(get(container, '#close'), 'pointerup')
    get(container, '#close').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
  })

  it('opens a nested dialog on press with press() without dismissing its parent', async () => {
    let { container, root } = render(
      <dialog.Context defaultOpen>
        <div id="parent" mix={dialog.surface()}>
          <dialog.Context>
            <button id="child-trigger" mix={[dialog.trigger(), press()]}>
              Child
            </button>
            <div id="child" mix={dialog.surface()}>
              <button id="child-close" mix={[dialog.close(), press()]}>
                Close child
              </button>
            </div>
          </dialog.Context>
        </div>
      </dialog.Context>,
    )
    await settle(root)
    let parent = get<HTMLElement>(container, '#parent')
    let child = get<HTMLElement>(container, '#child')

    pointer(get(container, '#child-trigger'), 'pointerdown')
    await settle(root)
    expect(child.matches('[data-open]')).toBe(true)

    pointer(document.body, 'pointerup')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle(root)
    expect(child.matches('[data-open]')).toBe(true)
    expect(parent.matches('[data-open]')).toBe(true)

    pointer(get(container, '#child-close'), 'pointerdown')
    await settle(root)
    expect(child.matches('[data-open]')).toBe(false)
    expect(parent.matches('[data-open]')).toBe(true)
    expect(document.activeElement?.id).toBe('child-trigger')
  })

  it('waits for the click when press() buttons are pressed by touch', async () => {
    let { container, root } = render(<PressExample />)
    let surface = get<HTMLElement>(container, '[role="dialog"]')

    expect(
      pointer(get(container, '#trigger'), 'pointerdown', { pointerType: 'touch' }).defaultPrevented,
    ).toBe(false)
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
    get<HTMLButtonElement>(container, '#trigger').click()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)

    pointer(get(container, '#close'), 'pointerdown', { pointerType: 'touch' })
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)
    get<HTMLButtonElement>(container, '#close').click()
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
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
    let overflow = getComputedStyle(document.documentElement).overflow
    let { root } = render(<Example defaultOpen />)
    await settle(root)
    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
    root.render(null)
    await settle(root)
    expect(getComputedStyle(document.documentElement).overflow).toBe(overflow)
    expect(document.querySelector('[data-open]')).toBe(null)
  })

  it('keeps the parent modal and its scroll lock when a nested dialog closes', async () => {
    let { container, root } = render(
      <dialog.Context defaultOpen>
        <div data-parent mix={dialog.surface()}>
          <dialog.Context>
            <button id="child-trigger" mix={dialog.trigger()}>
              Open child
            </button>
            <div data-child mix={dialog.surface()}>
              <button id="child-close" mix={dialog.close()}>
                Close child
              </button>
            </div>
          </dialog.Context>
        </div>
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
    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
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
          <div mix={dialog.surface()}>
            <button mix={dialog.close()}>Close</button>
          </div>
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
    let overflow = getComputedStyle(document.documentElement).overflow
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
    expect(getComputedStyle(document.documentElement).overflow).toBe(overflow)
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
    let overflow = getComputedStyle(document.documentElement).overflow
    let { container, root } = render(
      <>
        <button id="outside">Outside</button>
        <Example defaultOpen modal="trap-focus" closeOnOutsideClick={false} />
      </>,
    )
    await settle(root)
    let outside = get<HTMLButtonElement>(container, '#outside')
    expect(outside.closest('[inert]')).toBe(null)
    expect(getComputedStyle(document.documentElement).overflow).toBe(overflow)
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
        <div mix={dialog.surface({ initialFocus: false })}>
          <input autofocus id="autofocus" />
        </div>
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
          <div mix={dialog.surface()}>
            <input autofocus id="autofocus" />
          </div>
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
        <div mix={dialog.surface({ initialFocus: false, finalFocus: false })}>
          <button id="inside">Inside</button>
        </div>
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
        <div data-parent mix={dialog.surface()}>
          <dialog.Context>
            <button id="child-trigger" mix={dialog.trigger()}>
              Open child
            </button>
            <div data-child mix={dialog.surface()}>
              <button>Child action</button>
            </div>
          </dialog.Context>
        </div>
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
    let overflow = getComputedStyle(document.documentElement).overflow
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
            </popover.Context>
          </div>
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
    expect(getComputedStyle(document.documentElement).overflow).toBe(overflow)
    api?.show()
    await settle(root)
    expect(get(container, '[data-popup]').matches('[data-open]')).toBe(false)
  })

  it('keeps a detached popup in the dialog focus boundary and closes it with its owner', async () => {
    let api: dialog.DialogRef | undefined
    let overflow = getComputedStyle(document.documentElement).overflow
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
    expect(getComputedStyle(document.documentElement).overflow).toBe(overflow)
    expect(document.activeElement?.id).toBe('trigger')
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
          <div mix={dialog.surface()}>
            <button id="context-trigger" mix={menu.contextTrigger()}>
              Open actions
            </button>
          </div>
          <div data-menu mix={menu.popover()}>
            <div id="context-list" mix={menu.list()}>
              <button mix={menu.item({ name: 'archive' })}>Archive</button>
            </div>
          </div>
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

  it('keeps Tab from an open menu within the dialog focus boundary', async () => {
    let { container, root } = render(
      <dialog.Context defaultOpen>
        <div mix={dialog.surface()}>
          <input id="first" />
          <menu.Context label="Actions">
            <button id="menu-trigger" mix={menu.trigger()}>
              Actions
            </button>
            <div mix={menu.popover()}>
              <div id="menu-list" mix={menu.list()}>
                <button mix={menu.item({ name: 'archive' })}>Archive</button>
              </div>
            </div>
          </menu.Context>
        </div>
      </dialog.Context>,
    )
    await settle(root)
    get<HTMLButtonElement>(container, '#menu-trigger').click()
    await settle(root)
    let event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    get(container, '#menu-list').dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('first')
  })

  it('releases a dialog when its containing popover closes', async () => {
    let api: dialog.DialogRef | undefined
    let closePopover = () => {}
    let overflow = getComputedStyle(document.documentElement).overflow
    function DialogInPopover(handle: Handle) {
      let open = true
      closePopover = () => {
        open = false
        void handle.update()
      }
      return () => (
        <popover.Context>
          <button mix={popover.anchor({ placement: 'bottom-start' })}>Popover opener</button>
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
              <div mix={dialog.surface()}>
                <button mix={dialog.close()}>Close</button>
              </div>
            </dialog.Context>
          </div>
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
    expect(getComputedStyle(document.documentElement).overflow).toBe(overflow)
    expect(api?.open).toBe(false)
  })

  it('releases a controlled dialog even when its owner refuses an ancestor-close request', async () => {
    let closePopover = () => {}
    let rerender = () => {}
    let overflow = getComputedStyle(document.documentElement).overflow
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
          <div mix={popover.surface({ open, onHide: closePopover })}>
            <dialog.Context open onOpenChange={(_open, event) => event.preventDefault()}>
              <div mix={dialog.backdrop()} />
              <div mix={dialog.surface()}>
                <button>Inside</button>
              </div>
            </dialog.Context>
          </div>
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
    expect(getComputedStyle(document.documentElement).overflow).toBe(overflow)
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
