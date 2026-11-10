# toast

`toast` provides headless notifications with announcements, keyboard navigation and dismissal. Publish notifications through a shared manager while your components own the markup and styles.

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

- `createToastManager<data = unknown>()`: creates a manager with `add(options)`, `close(id?)` and a newest-first `toastItems` collection. Omit the ID from `close()` to dismiss all notifications. The manager supports native `change` subscriptions.
- `Context`: connects a stable `manager` to the UI. Accepts `defaultTimeout`, `limit` and a typed collection callback. There is no limit by default.
- `root({ label, hotkey = 'F6' })`: gives the collection named region semantics and keyboard entry. A non-empty `label` is required.
- `ItemContext`: scopes one notification using its ID as `value`.
- `item({ countdown? })`: applies non-modal dialog semantics, availability and focus recovery. With `countdown: true`, it animates the inherited `--toast-countdown` value from 1 to 0 for CSS indicators.
- `title()` and `description()`: connect your heading and supporting content to the notification. They generate IDs unless supplied and remove relationships when content is empty or removed.
- `close()`: dismisses the scoped notification from a native button. It defaults to `type="button"`.
- `ToastOptions<data>` and `ToastItem<data>`: published title, description, announcement, custom data, ID and timeout. Items also include a revision that increments when replaced.
- `ToastManager<data>`, `ToastContextProps<data>`, `ToastItemContextProps`, `ToastItemOptions` and `ToastRootOptions`: manager and component configuration types.

## Behavior Notes

- Notifications published before the UI mounts are retained.
- `add()` returns the notification ID. Reusing an ID replaces its complete content and options, restarts its timeout and preserves its position. Your renderer decides how to display custom `data` and actions.
- Toasts stay open unless a timeout is supplied. Set `timeout` in milliseconds or `false` to disable automatic dismissal. An explicit timeout overrides `Context`'s `defaultTimeout`, which can be a fixed value or callback.
- Timers belong to the rendered items. They start on presentation, pause for hover, keyboard focus, touch engagement, a hidden document or an unfocused window, and are cancelled on unmount. Remounting starts a fresh timeout.
- F6 enters the collection and returns to the previous element. Tab visits each notification before its controls. Leaving either Tab boundary returns focus. Escape dismisses the focused notification; closing it focuses a neighbour or returns to the previous element. Make the shortcut discoverable and use distinct shortcuts for separate managers.
- Announcements use the published title and description, excluding controls added by your renderer. Set `announcement` to replace the spoken message. Entering the collection clears the separate announcements and exposes the notifications for exploration. Actions remain available there; where possible, describe another way to perform them in the announcement.
- Supply the region label and a visible dismiss control. If a toast has no title, give its host an accessible name with `aria-label` or `aria-labelledby`. Essential information should also be available in the page.
- Render every item, including overflow marked with `data-limited`. Overflow and dismissed nodes are inert. CSS owns positioning and the `data-expanded` presentation; compose animation mixins to retain nodes during exit. Keep animated hosts and their item providers keyed by the notification ID.
