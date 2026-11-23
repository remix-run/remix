import { Portal as PlainPortal } from '@remix-run/component'
import { createElement, createRoot, on, type Handle, type RemixNode } from '@remix-run/component'
import * as dialog from '../dialog.ts'
import * as popover from '../popover.ts'
import * as menu from '../menu.tsx'
import * as select from '../select.tsx'
import * as combobox from '../combobox.tsx'
import * as toast from '../toast.tsx'
const parameters = new URLSearchParams(location.search)
const variant = location.pathname.startsWith('/plain')
  ? 'plain'
  : parameters.get('render') || 'portaled'
const portaled = variant !== 'inline'
const scenario = parameters.get('scenario') || 'form'
function Place(
  handle: Handle<{
    pattern: 'dialog' | 'popover' | 'menu' | 'select' | 'combobox'
    inline?: boolean
    portaled?: boolean
    children?: RemixNode
  }>,
) {
  return () =>
    !(handle.props.portaled ?? portaled) || handle.props.inline ? (
      handle.props.children
    ) : variant === 'plain' ? (
      <PlainPortal>{handle.props.children}</PlainPortal>
    ) : (
      createElement(
        { dialog, popover, menu, select, combobox }[handle.props.pattern].Portal,
        {},
        handle.props.children,
      )
    )
}
function Popup(handle: Handle<{ id: string; nested?: boolean }>) {
  let open = false
  return () => (
    <popover.Context>
      <button
        id={handle.props.id + '-trigger'}
        mix={[
          popover.anchor({ placement: 'bottom-start' }),
          popover.focusOnHide(),
          on('click', () => {
            open = !open
            void handle.update()
          }),
        ]}
      >
        Popover
      </button>
      {parameters.has('separated') ? (
        <label>
          Between trigger and popup
          <input id={handle.props.id + '-between'} />
        </label>
      ) : null}
      <Place pattern="popover">
        <popover.SurfaceContext>
          <section
            id={handle.props.id + '-surface'}
            className="popup"
            mix={popover.surface({
              open,
              onHide() {
                open = false
                void handle.update()
              },
            })}
          >
            <label>
              First
              <input id={handle.props.id + '-first'} />
            </label>
            {parameters.has('radio') && handle.props.nested ? (
              <>
                <label>
                  <input id="radio-one" type="radio" name="choice" defaultChecked />
                  One
                </label>
                <label>
                  <input id="radio-two" type="radio" name="choice" />
                  Two
                </label>
              </>
            ) : null}
            {handle.props.nested ? <Popup id={handle.props.id + '-child'} /> : null}
            <label>
              Last
              <input id={handle.props.id + '-last'} />
            </label>
          </section>
        </popover.SurfaceContext>
      </Place>
    </popover.Context>
  )
}
function Menu(handle: Handle<{ id: string }>) {
  return () => (
    <menu.Context label="Menu">
      <button id={handle.props.id + '-trigger'} mix={menu.trigger()}>
        Menu
      </button>
      <Place pattern="menu">
        <menu.PopoverContext>
          <section className="popup" id={handle.props.id + '-surface'} mix={menu.popover()}>
            <div id={handle.props.id + '-list'} mix={menu.list()}>
              <div mix={menu.item({ name: 'a' })}>Action A</div>
              <menu.Context label="Submenu">
                <div
                  id={handle.props.id + '-sub-trigger'}
                  mix={menu.submenuTrigger({ label: 'Submenu' })}
                >
                  Submenu
                </div>
                <Place
                  pattern="menu"
                  portaled={parameters.get('submenu') === 'portaled' ? true : undefined}
                >
                  <menu.PopoverContext>
                    <section className="popup" mix={menu.popover()}>
                      <div id={handle.props.id + '-sub-list'} mix={menu.list()}>
                        <div mix={menu.item({ name: 'b' })}>Action B</div>
                        <div mix={menu.item({ name: 'c' })}>Action C</div>
                      </div>
                    </section>
                  </menu.PopoverContext>
                </Place>
              </menu.Context>
            </div>
          </section>
        </menu.PopoverContext>
      </Place>
    </menu.Context>
  )
}
function Select(handle: Handle<{ id: string }>) {
  return () => (
    <select.Context defaultLabel="Select">
      <button id={handle.props.id + '-trigger'} mix={select.trigger()}>
        Select
      </button>
      <Place pattern="select">
        <select.PopoverContext>
          <section className="popup" id={handle.props.id + '-surface'} mix={select.popover()}>
            <div id={handle.props.id + '-list'} mix={select.list()}>
              <div mix={select.option({ label: 'Option A', value: 'a' })}>Option A</div>
              <div mix={select.option({ label: 'Option B', value: 'b' })}>Option B</div>
            </div>
          </section>
        </select.PopoverContext>
      </Place>
    </select.Context>
  )
}
function Combobox(handle: Handle<{ id: string }>) {
  return () => (
    <combobox.Context>
      <input
        id={handle.props.id + '-input'}
        placeholder="Combobox"
        aria-label="Combobox"
        mix={combobox.input()}
      />
      <Place pattern="combobox">
        <combobox.PopoverContext>
          <section className="popup" id={handle.props.id + '-surface'} mix={combobox.popover()}>
            <div mix={combobox.list()}>
              <div mix={combobox.option({ label: 'Option A', value: 'a' })}>Option A</div>
              <div mix={combobox.option({ label: 'Option B', value: 'b' })}>Option B</div>
            </div>
          </section>
        </combobox.PopoverContext>
      </Place>
    </combobox.Context>
  )
}
function Patterns(handle: Handle<{ id: string }>) {
  return () => (
    <div className="fields">
      <label>
        Before
        <input id={handle.props.id + '-before'} />
      </label>
      <Popup id={handle.props.id + '-popup'} nested />
      <label>
        After popover
        <input id={handle.props.id + '-after-popup'} />
      </label>
      <Menu id={handle.props.id + '-menu'} />
      <label>
        After menu
        <input id={handle.props.id + '-after-menu'} />
      </label>
      <Select id={handle.props.id + '-select'} />
      <label>
        After select
        <input id={handle.props.id + '-after-select'} />
      </label>
      <Combobox id={handle.props.id + '-combo'} />
      <label>
        After combobox
        <input id={handle.props.id + '-after-combo'} />
      </label>
    </div>
  )
}
function Modal(
  handle: Handle<{ id: string; mode?: boolean | 'trap-focus'; nested?: boolean; inline?: boolean }>,
) {
  return () => (
    <dialog.Context modal={handle.props.mode}>
      <button id={handle.props.id + '-trigger'} mix={dialog.trigger()}>
        {handle.props.mode === false
          ? 'Non-modal dialog'
          : handle.props.mode === 'trap-focus'
            ? 'Focus-trapping dialog'
            : 'Dialog'}
      </button>
      <Place pattern="dialog" inline={handle.props.inline}>
        <div className="backdrop" mix={dialog.backdrop()} />
        <dialog.SurfaceContext>
          <section className="dialog" id={handle.props.id + '-surface'} mix={dialog.surface()}>
            <h2 mix={dialog.title()}>Dialog</h2>
            <Patterns id={handle.props.id} />
            {handle.props.nested ? (
              <Modal
                id={handle.props.id + '-child'}
                inline={parameters.get('nested') !== 'portaled'}
              />
            ) : null}
            <button id={handle.props.id + '-close'} mix={dialog.close()}>
              Close
            </button>
          </section>
        </dialog.SurfaceContext>
      </Place>
    </dialog.Context>
  )
}
function App() {
  if (scenario === 'toast') return () => <Notifications />
  if (scenario === 'toast-dialog') return () => <NotificationDialog />
  return () => (
    <>
      <h1>Portal focus QA</h1>
      {scenario === 'form' ? (
        <Patterns id="form" />
      ) : (
        <>
          <label>
            Outside before
            <input id="outside-before" />
          </label>
          <Modal
            id="modal"
            nested
            mode={
              scenario === 'non-modal' ? false : scenario === 'trap-focus' ? 'trap-focus' : true
            }
          />
          <label>
            Outside after
            <input id="outside-after" />
          </label>
        </>
      )}
    </>
  )
}
function NotificationDialog() {
  let toastManager = toast.createToastManager()
  let dialogRef: dialog.DialogRef | undefined
  return () => (
    <>
      <dialog.Context ref={(value) => (dialogRef = value)}>
        <button id="notification-dialog-trigger" mix={dialog.trigger()}>
          Open dialog
        </button>
        <dialog.Portal>
          <dialog.SurfaceContext>
            <section id="notification-dialog" className="dialog" mix={dialog.surface()}>
              <h2 mix={dialog.title()}>Dialog</h2>
              <button
                id="notification-publish"
                mix={on('click', () => {
                  toastManager.add({ title: 'Notification' })
                })}
              >
                Toast
              </button>
              <Popup id="notification-popup" />
            </section>
          </dialog.SurfaceContext>
        </dialog.Portal>
      </dialog.Context>
      <PlainPortal>
        <toast.Context manager={toastManager}>
          {(items) => (
            <section
              id="notification-region"
              className="notifications"
              mix={toast.root({ label: 'Notifications' })}
            >
              {items.map((value) => (
                <toast.ItemContext key={value.id} value={value.id}>
                  <article mix={toast.item()}>
                    <h2 mix={toast.title()}>{value.title}</h2>
                    <button id="notification-action">Action</button>
                    <button
                      id="notification-close-owner"
                      mix={on('click', () => dialogRef?.close())}
                    >
                      Close dialog
                    </button>
                  </article>
                </toast.ItemContext>
              ))}
            </section>
          )}
        </toast.Context>
      </PlainPortal>
    </>
  )
}
function Notifications() {
  let manager = toast.createToastManager()
  return () => (
    <>
      <button
        id="toast-origin"
        mix={on('click', () => {
          manager.add({ id: 'notification', title: 'Notification' })
        })}
      >
        Show notification
      </button>
      <toast.Context manager={manager}>
        {(items) => (
          <section id="notifications" mix={toast.root({ label: 'Notifications' })}>
            {items.map((value) => (
              <toast.ItemContext key={value.id} value={value.id}>
                <article mix={toast.item()}>
                  <h2 mix={toast.title()}>{value.title}</h2>
                  <button id="toast-action" mix={toast.close()}>
                    Dismiss
                  </button>
                </article>
              </toast.ItemContext>
            ))}
          </section>
        )}
      </toast.Context>
    </>
  )
}
const container = document.createElement('div')
document.body.append(container)
const root = createRoot(container)
root.render(<App />)
root.flush()
