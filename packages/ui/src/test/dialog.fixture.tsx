import { Portal } from '../portal.tsx'
import { createRoot, on, type Handle } from '@remix-run/component'
import * as dialog from '../dialog.ts'
import * as popover from '../popover.ts'
import * as menu from '../menu.tsx'
import * as select from '../select.tsx'
import * as combobox from '../combobox.tsx'

function FixturePopover(handle: Handle<{ open: boolean; onHide(): void }>) {
  return () => (
    <Portal>
      <div data-testid="popover" mix={popover.surface(handle.props)}>
        <button id="popup-action" mix={popover.focusOnShow()}>
          Popover action
        </button>
      </div>
    </Portal>
  )
}

function DialogFixture(handle: Handle) {
  let popoverOpen = false
  let outsideClicks = 0
  let modal = new URLSearchParams(location.search).get('modal') !== 'false'
  let detached = new URLSearchParams(location.search).has('detached')
  function hidePopover() {
    popoverOpen = false
    void handle.update()
  }
  let confirmation: dialog.DialogRef | undefined
  return () => (
    <>
      <button
        id="outside"
        mix={on('click', () => {
          outsideClicks++
          void handle.update()
        })}
      >
        Outside {outsideClicks}
      </button>
      <popover.Context>
        <dialog.Context
          modal={modal}
          onOpenChange={(open, event) => {
            if (
              !open &&
              event.reason === 'outside-click' &&
              new URLSearchParams(location.search).has('confirm')
            ) {
              event.preventDefault()
              confirmation?.show()
            }
          }}
        >
          <button id="trigger" mix={dialog.trigger()}>
            Open dialog
          </button>
          {!modal ? (
            <button id="second-trigger" mix={dialog.trigger()}>
              Another opener
            </button>
          ) : null}
          {modal ? (
            <Portal>
              <div data-testid="backdrop" mix={dialog.backdrop()} />
            </Portal>
          ) : null}
          <Portal>
            <div data-testid="dialog" mix={dialog.surface()}>
              <h2 mix={dialog.title()}>Edit profile</h2>
              <p mix={dialog.description()}>Update your details.</p>
              <input id="name" aria-label="Name" mix={dialog.focusOnShow()} />
              <button
                id="popover-trigger"
                mix={[
                  popover.anchor({ placement: 'bottom-start' }),
                  popover.focusOnHide(),
                  on('click', () => {
                    popoverOpen = true
                    void handle.update()
                  }),
                ]}
              >
                Open popover
              </button>
              {!detached ? <FixturePopover open={popoverOpen} onHide={hidePopover} /> : null}
              <select.Context defaultLabel="Choose framework">
                <popover.Context>
                  <button id="select-trigger" mix={select.trigger()} />
                  <Portal>
                    <div data-testid="select" mix={select.popover()}>
                      <div mix={select.list()}>
                        <div mix={select.option({ label: 'Remix', value: 'remix' })}>Remix</div>
                        <div mix={select.option({ label: 'React', value: 'react' })}>React</div>
                      </div>
                    </div>
                  </Portal>
                </popover.Context>
              </select.Context>
              <combobox.Context>
                <input id="combobox-input" aria-label="Search frameworks" mix={combobox.input()} />
                <Portal>
                  <div data-testid="combobox" mix={combobox.popover()}>
                    <div mix={combobox.list()}>
                      <div mix={combobox.option({ label: 'Remix', value: 'remix' })}>Remix</div>
                      <div mix={combobox.option({ label: 'React', value: 'react' })}>React</div>
                    </div>
                  </div>
                </Portal>
              </combobox.Context>
              <dialog.Context
                ref={(value) => {
                  confirmation = value
                }}
              >
                <button id="child-trigger" mix={dialog.trigger()}>
                  Open confirmation
                </button>
                <Portal>
                  <div data-testid="child-backdrop" mix={dialog.backdrop()} />
                </Portal>
                <Portal>
                  <div data-testid="child-dialog" mix={dialog.surface()}>
                    <h2 mix={dialog.title()}>Confirm changes</h2>
                    <button id="child-close" mix={dialog.close()}>
                      Confirm
                    </button>
                  </div>
                </Portal>
              </dialog.Context>
              <button id="close" mix={dialog.close()}>
                Done
              </button>
              <menu.Context label="Actions">
                <button id="menu-trigger" mix={menu.trigger()}>
                  Actions
                </button>
                <Portal>
                  <div data-testid="menu" mix={menu.popover()}>
                    <div mix={menu.list()}>
                      <button mix={menu.item({ name: 'archive' })}>Archive</button>
                    </div>
                  </div>
                </Portal>
              </menu.Context>
            </div>
          </Portal>
          {detached ? <FixturePopover open={popoverOpen} onHide={hidePopover} /> : null}
        </dialog.Context>
      </popover.Context>
    </>
  )
}

const container = document.createElement('div')
container.id = 'app'
document.body.append(container)
createRoot(container).render(<DialogFixture />)
