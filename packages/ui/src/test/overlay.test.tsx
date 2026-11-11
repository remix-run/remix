import { afterEach, describe, it } from '@remix-run/test'
import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'

import * as combobox from '../combobox.tsx'
import * as dialog from '../dialog.ts'
import * as menu from '../menu.tsx'
import * as popover from '../popover.ts'
import * as select from '../select.tsx'
import {
  expectAccessible,
  expectEscapeClosesTopmostOnly,
  expectExitRetainsLayer,
  expectFocusMovesInAndReturns,
  expectOutsidePressDismisses,
  expectOutsideShielded,
  expectScrollLockAppliedAndRestored,
  settle,
  type Overlay,
} from './conformance.ts'

let roots: ReturnType<typeof createRoot>[] = []

function mount(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function get(container: HTMLElement, selector: string) {
  let node = container.querySelector<HTMLElement>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

function click(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
}

function key(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }))
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }
  roots = []
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
})

function DialogExample() {
  return () => (
    <>
      <button id="outside">Outside</button>
      <dialog.Context>
        <button id="trigger" mix={dialog.trigger()}>
          Open dialog
        </button>
        <div mix={dialog.surface()}>
          <h2 mix={dialog.title()}>Profile</h2>
          <button id="nested-trigger" mix={dialog.trigger()}>
            Open nested
          </button>
          <button mix={dialog.close()}>Done</button>
        </div>
      </dialog.Context>
    </>
  )
}

function NestedDialogExample() {
  return () => (
    <dialog.Context>
      <button id="trigger" mix={dialog.trigger()}>
        Open dialog
      </button>
      <div id="parent" mix={dialog.surface()}>
        <h2 mix={dialog.title()}>Parent</h2>
        <dialog.Context>
          <button id="nested-trigger" mix={dialog.trigger()}>
            Open nested
          </button>
          <div id="child" mix={dialog.surface()}>
            <h2 mix={dialog.title()}>Child</h2>
            <button mix={dialog.close()}>Done</button>
          </div>
        </dialog.Context>
      </div>
    </dialog.Context>
  )
}

function mountDialog() {
  let { container, root } = mount(<DialogExample />)
  let trigger = get(container, '#trigger')
  return {
    root,
    trigger,
    surface: get(document.body, '[role="dialog"]'),
    outside: get(container, '#outside'),
    async open() {
      click(trigger)
      await settle(root)
    },
  } satisfies Overlay
}

function mountNestedDialogs() {
  let { container, root } = mount(<NestedDialogExample />)
  let trigger = get(container, '#trigger')
  let nestedTrigger = get(container, '#nested-trigger')
  let outside = document.body
  return {
    parent: {
      root,
      trigger,
      surface: get(document.body, '#parent'),
      outside,
      async open() {
        click(trigger)
        await settle(root)
      },
    } satisfies Overlay,
    child: {
      root,
      trigger: nestedTrigger,
      surface: get(document.body, '#child'),
      outside,
      async open() {
        click(nestedTrigger)
        await settle(root)
      },
    } satisfies Overlay,
  }
}

function PopoverExample(handle: Handle<{ nested?: boolean }>) {
  let open = false
  let nestedOpen = false
  return () => (
    <popover.Context>
      <button id="outside">Outside</button>
      <button
        id="anchor"
        mix={[
          popover.anchor({ placement: 'bottom-start' }),
          popover.focusOnHide(),
          on('click', () => {
            open = true
            void handle.update()
          }),
        ]}
      >
        Open popover
      </button>
      <div
        id="surface"
        role="group"
        aria-label="Popover"
        mix={popover.surface({
          open,
          onHide() {
            open = false
            void handle.update()
          },
        })}
      >
        <button id="inside" mix={popover.focusOnShow()}>
          Inside
        </button>
        <popover.Context>
          <button
            id="nested-anchor"
            mix={[
              popover.anchor({ placement: 'bottom-start' }),
              popover.focusOnHide(),
              on('click', () => {
                nestedOpen = true
                void handle.update()
              }),
            ]}
          >
            Open nested
          </button>
          <div
            id="nested-surface"
            role="group"
            aria-label="Nested popover"
            mix={popover.surface({
              open: nestedOpen,
              onHide() {
                nestedOpen = false
                void handle.update()
              },
            })}
          >
            <button id="nested-inside" mix={popover.focusOnShow()}>
              Nested inside
            </button>
          </div>
        </popover.Context>
      </div>
    </popover.Context>
  )
}

function mountPopover() {
  let { container, root } = mount(<PopoverExample />)
  let trigger = get(container, '#anchor')
  let nestedTrigger = get(container, '#nested-anchor')
  let outside = get(container, '#outside')
  return {
    parent: {
      root,
      trigger,
      surface: get(container, '#surface'),
      outside,
      async open() {
        click(trigger)
        await settle(root)
      },
    } satisfies Overlay,
    child: {
      root,
      trigger: nestedTrigger,
      surface: get(container, '#nested-surface'),
      outside,
      async open() {
        click(nestedTrigger)
        await settle(root)
      },
    } satisfies Overlay,
  }
}

function MenuExample() {
  return () => (
    <>
      <button id="outside">Outside</button>
      <menu.Context label="Actions">
        <button id="trigger" mix={menu.trigger()}>
          Actions
        </button>
        <div id="surface" mix={menu.popover()}>
          <div mix={menu.list()}>
            <div mix={menu.item({ name: 'rename', label: 'Rename' })}>Rename</div>
            <div mix={menu.item({ name: 'save', label: 'Save' })}>Save</div>
          </div>
        </div>
      </menu.Context>
    </>
  )
}

function mountMenu() {
  let { container, root } = mount(<MenuExample />)
  let trigger = get(container, '#trigger')
  return {
    root,
    trigger,
    surface: get(container, '#surface'),
    outside: get(container, '#outside'),
    async open() {
      click(trigger)
      await settle(root)
    },
  } satisfies Overlay
}

function SelectExample() {
  return () => (
    <>
      <button id="outside">Outside</button>
      <select.Context defaultLabel="Select a framework">
        <button id="trigger" type="button" mix={select.trigger()}>
          Select a framework
        </button>
        <popover.Context>
          <div id="surface" mix={select.popover()}>
            <div aria-label="Framework" mix={select.list()}>
              <div mix={select.option({ label: 'Remix framework', value: 'remix' })}>Remix</div>
              <div mix={select.option({ label: 'React framework', value: 'react' })}>React</div>
            </div>
          </div>
        </popover.Context>
      </select.Context>
    </>
  )
}

function mountSelect() {
  let { container, root } = mount(<SelectExample />)
  let trigger = get(container, '#trigger')
  return {
    root,
    trigger,
    surface: get(container, '#surface'),
    outside: get(container, '#outside'),
    async open() {
      click(trigger)
      await settle(root)
    },
  } satisfies Overlay
}

function ComboboxExample() {
  return () => (
    <>
      <button id="outside">Outside</button>
      <combobox.Context>
        <div>
          <input id="trigger" aria-label="Framework" mix={combobox.input()} />
          <div id="surface" mix={combobox.popover()}>
            <div mix={combobox.list()}>
              <div mix={combobox.option({ label: 'Remix framework', value: 'remix' })}>Remix</div>
              <div mix={combobox.option({ label: 'React framework', value: 'react' })}>React</div>
            </div>
          </div>
        </div>
      </combobox.Context>
    </>
  )
}

function mountCombobox() {
  let { container, root } = mount(<ComboboxExample />)
  let trigger = get(container, '#trigger')
  return {
    root,
    trigger,
    surface: get(container, '#surface'),
    outside: get(container, '#outside'),
    async open() {
      trigger.focus()
      key(trigger, 'ArrowDown')
      await settle(root)
    },
  } satisfies Overlay
}

describe('overlay conformance: dialog', () => {
  it('has no axe violations while open', async () => {
    await expectAccessible(mountDialog())
  })

  it('moves focus in on open and back to the trigger on close', async () => {
    await expectFocusMovesInAndReturns(mountDialog())
  })

  it('closes only the topmost nested dialog on Escape', async () => {
    let { parent, child } = mountNestedDialogs()
    await expectEscapeClosesTopmostOnly(parent, child)
  })

  it('dismisses on an outside press', async () => {
    await expectOutsidePressDismisses(mountDialog())
  })

  it('shields outside content from focus and assistive technology', async () => {
    await expectOutsideShielded(mountDialog())
  })

  it('locks page scrolling and restores it on close', async () => {
    await expectScrollLockAppliedAndRestored(mountDialog())
  })

  it('retains data-open through exit motion', async () => {
    await expectExitRetainsLayer(mountDialog())
  })
})

describe('overlay conformance: popover', () => {
  it('has no axe violations while open', async () => {
    await expectAccessible(mountPopover().parent)
  })

  it('moves focus in on open and back to the anchor on close', async () => {
    await expectFocusMovesInAndReturns(mountPopover().parent)
  })

  it('closes only the topmost nested popover on Escape', async () => {
    let { parent, child } = mountPopover()
    await expectEscapeClosesTopmostOnly(parent, child)
  })

  it('dismisses on an outside press', async () => {
    await expectOutsidePressDismisses(mountPopover().parent)
  })

  it('locks page scrolling and restores it on close', async () => {
    await expectScrollLockAppliedAndRestored(mountPopover().parent)
  })

  it('retains data-open through exit motion', async () => {
    await expectExitRetainsLayer(mountPopover().parent)
  })
})

describe('overlay conformance: menu', () => {
  it('has no axe violations while open', async () => {
    await expectAccessible(mountMenu())
  })

  it('moves focus in on open and back to the trigger on close', async () => {
    await expectFocusMovesInAndReturns(mountMenu())
  })

  it('dismisses on an outside press', async () => {
    await expectOutsidePressDismisses(mountMenu())
  })

  it('locks page scrolling and restores it on close', async () => {
    await expectScrollLockAppliedAndRestored(mountMenu())
  })

  it('retains data-open through exit motion', async () => {
    await expectExitRetainsLayer(mountMenu())
  })
})

describe('overlay conformance: select', () => {
  it('has no axe violations while open', async () => {
    await expectAccessible(mountSelect())
  })

  it('moves focus in on open and back to the trigger on close', async () => {
    await expectFocusMovesInAndReturns(mountSelect())
  })

  it('dismisses on an outside press', async () => {
    await expectOutsidePressDismisses(mountSelect())
  })

  it('locks page scrolling and restores it on close', async () => {
    await expectScrollLockAppliedAndRestored(mountSelect())
  })

  it('retains data-open through exit motion', async () => {
    await expectExitRetainsLayer(mountSelect())
  })
})

describe('overlay conformance: combobox', () => {
  it('has no axe violations while open', async () => {
    await expectAccessible(mountCombobox())
  })

  it('keeps focus on the input while open and after close', async () => {
    await expectFocusMovesInAndReturns(mountCombobox(), { focusStaysOnTrigger: true })
  })

  it('dismisses on an outside press', async () => {
    await expectOutsidePressDismisses(mountCombobox())
  })

  it('locks page scrolling and restores it on close', async () => {
    await expectScrollLockAppliedAndRestored(mountCombobox())
  })

  it('retains data-open through exit motion', async () => {
    await expectExitRetainsLayer(mountCombobox())
  })
})
