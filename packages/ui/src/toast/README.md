# toast

Publish retained notifications from components or utilities and render them near the application root. The manager retains notification state. Providers and mixins connect your markup to announcements, focus and dismissal.

## Usage

```tsx
import * as toast from '@remix-run/ui/toast'
import { css, on } from 'remix/component'

export const notifications = toast.createToastManager()

export function SaveButton() {
  return () => (
    <button type="button" mix={on('click', () => notifications.add({ title: 'Changes saved' }))}>
      Save
    </button>
  )
}

export function Notifications() {
  return () => (
    <toast.Context manager={notifications} limit={3}>
      {(records) => (
        <section
          mix={[
            toast.root({ label: 'Notifications' }),
            css({ position: 'fixed', insetInlineEnd: '16px', bottom: '16px' }),
          ]}
        >
          {records.map((notification) => (
            <toast.ItemContext key={notification.id} toast={notification}>
              <article
                key={notification.id}
                mix={[toast.item(), css({ '&[data-limited]': { display: 'none' } })]}
              >
                <h2 mix={toast.title()}>{notification.title}</h2>
                <p mix={toast.description()}>{notification.description}</p>
                {notification.action}
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

Supply the region label and control labels. Mount one `Context` per manager, outside clipping containers. It uses ordinary document rendering without a portal or top layer. Scope server-side managers to an application instance or request.

## `@remix-run/ui/toast`

- `createToastManager<action = RemixNode>()`: creates retained state and commands. The complete collection is newest first. Repeated IDs retain their position.
- `Context`: accepts a stable `manager`, an optional `limit` (default 3), and a typed collection callback. Render every record, including overflow.
- `root({ label, hotkey = 'F6' })`: gives the collection named region semantics and polite announcements. A non-empty `label` is required.
- `ItemContext`: accepts the current `toast` record and scopes its markup. Key the provider and animated host by the record ID.
- `item()`: applies non-modal dialog semantics, presentation lifetime, availability and focus recovery. It is a Tab stop before the controls.
- `title()` and `description()`: connect authored heading and supporting elements through `aria-labelledby` and `aria-describedby`. They generate IDs unless you supply them, and remove relationships when a part is empty or removed. They supply no elements or content.
- `close()`: dismisses the scoped toast from a native button. Supply translated text or an accessible label for an icon button. It defaults to `type="button"` and excludes the control from passive announcements while the collection is collapsed.
- `countdown(record)`: animates the inherited `--toast-remaining` CSS property from 1 to 0 using the record's clock. Its host is decorative (`aria-hidden`) and hidden for persistent records.
- `ToastOptions<action>`: optional renderable `title` and `description`, generic `action`, `id`, `duration` and `priority`.
- `ToastRecord<action>`: immutable content, resolved `priority`, and sampled clock state: `presented`, `paused`, `remaining` and `duration`.
- `ToastManager<action>`: `add`, `update`, `close`, `pause`, `resume`, `present` and `toasts`. Native `change` subscriptions support `AbortSignal` cleanup.
- `ToastContextProps<action>`, `ToastItemContextProps<action>` and `ToastRootOptions`: configuration types.

## Announcements and keyboard access

Ordinary notifications use the collection's polite live region. Title and description accept JSX; render them inside elements with the corresponding mixins so their accessible relationships follow the actual content.

If you omit the title, supply an accessible name on the item with `aria-label` or `aria-labelledby`.

Set `priority: 'high'` for urgent announcements. A separate assertive alert contains the published title and description. While the collection has keyboard focus, that copy is removed and the high-priority `alertdialog` is exposed for exploration. Extra authored content and actions are not copied into urgent announcements. Priority does not change duration, visual styling or focus automatically.

F6 enters the collection and F6 again returns to the previous element. Tab visits each available notification before its controls. Shift+Tab from the collection, or Tab past either boundary, returns to the previous element. Escape dismisses the focused notification. Closing it moves focus to a neighbouring mounted, available notification or returns to the previous element. Focus is not deferred to a future mount. Make the shortcut discoverable in your application; change or disable `hotkey` for secondary managers.

Use native buttons and links for actions. Generic action data may describe one or multiple controls; actions do not implicitly dismiss. Provide a visible dismiss button so swiping is not the only dismissal method. Essential information and decisions should also be available in the page. Evaluate speech with the assistive technologies your application supports, and test placement and focus alongside modal dialogs.

## Timers and motion

Plain notifications default to 5000 milliseconds. Actions default to persistent; only `null` and `undefined` mean no action. An explicit finite, non-negative `duration` overrides that policy; zero persists. `add()` merges duplicate IDs and restarts their lifetime. `update()` restarts only when it supplies `duration`.

Timers run while `item()` presents the record, including limited records. Publications before mounting retain their full lifetime; unmounting pauses without discarding them. Hover, keyboard focus, touch engagement, document visibility, window blur and manual `pause(reason)` calls compose. `resume(reason)` removes only its own reason.

A primary touch inside the collection expands it and pauses dismissal until a primary touch outside. Releasing or cancelling a gesture keeps it expanded. Touching outside clears hover and blurs focus inside; native controls retain normal activation.

`root()` exposes `data-expanded`; `item()` exposes `data-limited`. CSS chooses the stack, offsets and expanded presentation. The primitive does not measure elements or own animation styles. Keep overflow mounted and inert for transitions. Compose `animateLayout()`, `animateEntrance()` and `animateExit()` with your styles, respecting reduced motion. Keep decorative depth transforms on a separate surface from the host animated by layout. Closing removes the record immediately; exit animation may retain its inert DOM.

## Countdown indicators

Apply `countdown(record)` to a decorative wrapper and map its inherited value with CSS:

```tsx
<div
  mix={[
    toast.countdown(notification),
    css({
      height: '2px',
      background: 'currentColor',
      transform: 'scaleX(var(--toast-remaining, 1))',
      transformOrigin: 'left',
    }),
  ]}
/>
```

For an SVG ring, use an HTML wrapper with the mixin and map the inherited fraction to `stroke-dashoffset`. Keep interactive content outside the wrapper because it is hidden from assistive technology. The manager closes the toast independently of the indicator. Clock snapshots synchronise pause, resume and lifetime changes without per-frame component updates; the inherited CSS property may still require browser style work each frame.
