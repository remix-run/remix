# toast

Toast notifications with accessible interactions and pausable timers.

## Usage

```tsx
import * as toast from '@remix-run/ui/toast'
import { css, on } from 'remix/component'

export const toastManager = toast.createToastManager()

export function SaveButton() {
  return () => (
    <button type="button" mix={on('click', () => toastManager.add({ title: 'Changes saved' }))}>
      Save
    </button>
  )
}

export function Notifications() {
  return () => (
    <toast.Context manager={toastManager} limit={3}>
      {(toastItems) => (
        <section
          mix={[
            toast.root({ label: 'Notifications' }),
            css({ position: 'fixed', insetInlineEnd: '16px', bottom: '16px' }),
          ]}
        >
          {toastItems.map((toastItem) => (
            <toast.ItemContext key={toastItem.id} value={toastItem.id}>
              <article
                key={toastItem.id}
                mix={[toast.item(), css({ '&[data-limited]': { display: 'none' } })]}
              >
                <h2 mix={toast.title()}>{toastItem.title}</h2>
                <p mix={toast.description()}>{toastItem.description}</p>
                <button mix={toast.close()}>Dismiss</button>
              </article>
            </toast.ItemContext>
          ))}
        </section>
      )}
    </toast.Context>
  )
}
```

## `@remix-run/ui/toast`

- `createToastManager<data = unknown>()`: creates a manager with `add(options)`, `close(id)`, `closeAll()` and a newest-first `items` collection. The manager supports native `change` subscriptions.
- `Context`: connects a stable `manager` to the UI after mounting. Accepts `limit` and a typed collection callback. There is no limit by default.
- `root({ label })`: gives the collection named region semantics and keyboard entry. A non-empty `label` is required.
- `ItemContext`: scopes one notification using its ID as `value`.
- `item({ countdown? })`: applies non-modal dialog semantics, availability and focus recovery. With `countdown: true`, it animates the inherited `--toast-countdown` value from 1 to 0 for CSS indicators.
- `title()` and `description()`: connect your heading and supporting content to the notification. They generate IDs unless supplied.
- `close()`: dismisses the scoped notification from a native button. It defaults to `type="button"`.
- `ToastAddOptions<data>` and `ToastItem<data>`: published title, description, announcement, custom data, ID and timeout. Items also include a revision that increments when replaced.
- `ToastManager<data>`, `ToastContextProps<data>`, `ToastItemContextProps`, `ToastItemOptions` and `ToastRootOptions`: manager and component configuration types.

## Behavior Notes

- `add()` returns the notification ID. Reusing an ID replaces its complete content and options, restarts its timeout and preserves its position. Your renderer decides how to display custom `data` and actions.
- Toasts stay open unless a timeout is supplied. Set `timeout` in milliseconds when publishing a toast.
- Hover, keyboard focus, touch engagement, a hidden document or an unfocused window pause timers.
- F6 and ordinary Tab entry remember the previous element for returning. Tab movement within the collection follows browser keyboard settings. Boundary guards return focus after a keyboard visit. Escape dismisses the focused notification and stops the event from reaching underlying layers. Closing it focuses a neighbour or returns to the remembered element. Pointer and unrelated programmatic entry do not establish a return target. Make the shortcut discoverable.
- A global `root()` remains interactive with Remix modal dialogs open. Toast clicks keep the modal open and dismiss transient popups as outside clicks normally would. Closing a dialog preserves notification focus and updates its remembered return target, unless an explicit `finalFocus` or `focusOnHide()` target overrides it. Render the collection outside the dialog and give it a `z-index` above the dialog stack. Use `Portal` to escape clipping or ancestor stacking contexts.
- Announcements use the published title and description, excluding controls added by your renderer. Set `announcement` to replace the spoken message. Entering the collection clears the separate announcements and exposes the notifications for exploration. Actions remain available there; where possible, describe another way to perform them in the announcement.
- Supply the region label and a visible dismiss control. If a toast has no title, give its host an accessible name with `aria-label` or `aria-labelledby`. Essential information should also be available in the page.
- Render every item, including overflow marked with `data-limited`. Overflow and dismissed nodes are inert. CSS owns positioning and the `data-expanded` presentation; compose animation mixins to retain nodes during exit. Keep animated hosts and their item providers keyed by the notification ID.
