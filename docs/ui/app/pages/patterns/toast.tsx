import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Toast',
  slug: 'toast',
  category: 'patterns',
  description:
    'Publish notifications from anywhere, with retained state, typed actions and pausable timers.',
  importPath: '@remix-run/ui/toast',
} satisfies PageMeta

const basic = await loadExample('toast/basic', { outlet: 'ToastRegion' })
const undo = await loadExample('toast/undo', { outlet: 'ToastRegion' })
const updates = await loadExample('toast/updates', { outlet: 'ToastRegion' })
const actions = await loadExample('toast/actions', { outlet: 'ToastRegion' })
const stack = await loadExample('toast/stack', { outlet: 'ToastRegion' })
const timed = await loadExample('toast/timed', { outlet: 'ToastRegion' })

const anatomy = await highlightSource(`
  import * as toast from '@remix-run/ui/toast'
  import { css, on } from 'remix/component'

  const notifications = toast.createToastManager()

  const element = <toast.Context manager={notifications} limit={3}>
    {toasts => (
      <section mix={[
        toast.root({ label: 'Notifications' }),
        css({
          '&[data-expanded]': {},
          '&:focus-visible': {},
        }),
      ]}>
        {toasts.map(notification => (
          <toast.ItemContext key={notification.id} toast={notification}>
          <article key={notification.id} mix={[
            toast.item(),
            css({
              '&[data-limited]': {},
              '&:focus-visible': {},
            }),
          ]}>
            <div>
              <h2 mix={toast.title()}>{notification.title}</h2>
              <p mix={toast.description()}>{notification.description}</p>
              {notification.action}
              <button type="button" mix={toast.close()}>
                Dismiss
              </button>
            </div>
          </article>
          </toast.ItemContext>
        ))}
      </section>
    )}
  </toast.Context>
`)

const countdownCode = await highlightSource(`
  // Inside the toast.Context callback, for each notification:
  const bar = <div mix={[
    css({
      height: '2px',
      background: 'currentColor',
      transform: 'scaleX(var(--toast-remaining, 1))',
      transformOrigin: 'left',
    }),
    toast.countdown(notification),
  ]} />
`)

const publishers = await highlightSource(`
  import { createToastManager } from '@remix-run/ui/toast'

  // Share this manager with your region and notification publishers.
  export const notifications = createToastManager()

  notifications.add({ title: 'Settings saved' })
`)

const subscribe = await highlightSource(`
  let subscription = new AbortController()
  notifications.addEventListener('change', () => {
    console.log(notifications.toasts)
  }, { signal: subscription.signal })

  subscription.abort()
`)

const typed = await highlightSource(`
  interface Action {
    label: string
    run(): void
  }

  const notifications = toast.createToastManager<Action>()

  notifications.add({
    title: 'Note archived',
    action: { label: 'Undo', run: restoreNote },
  })

  const element = <toast.Context manager={notifications}>
    {toasts => (
      <section mix={toast.root({ label: 'Notifications' })}>
        {toasts.map(notification => (
          <toast.ItemContext key={notification.id} toast={notification}>
          <article key={notification.id} mix={toast.item()}>
            <div>
              <h2 mix={toast.title()}>{notification.title}</h2>
              {notification.action && (
                <button type="button" mix={on('click', notification.action.run)}>
                  {notification.action.label}
                </button>
              )}
            </div>
          </article>
          </toast.ItemContext>
        ))}
      </section>
    )}
  </toast.Context>
`)

const timing = await highlightSource(`
  let pauseReason = Symbol('application pause')
  notifications.pause(pauseReason)

  // Resume only this reason. Hover or focus can still keep timers paused.
  notifications.resume(pauseReason)
`)

const position = await highlightSource(`
  const element = <section mix={[
    toast.root({ label: 'Notifications' }),
    css({
      position: 'fixed',
      insetInlineEnd: '16px',
      width: 'min(380px, calc(100vw - 32px))',
      bottom: 'max(16px, env(safe-area-inset-bottom))',
    }),
  ]}>
    {toasts.map(renderToast)}
  </section>
`)

const typeDefinitions = {
  ToastOptions: await highlightSource(`
interface ToastOptions<action = RemixNode> {
  id?: string
  title?: RemixNode
  description?: RemixNode
  action?: action
  duration?: number
  priority?: 'low' | 'high'
}
`),
  ToastRecord: await highlightSource(`
interface ToastRecord<action = RemixNode> {
  readonly id: string
  readonly title?: RemixNode
  readonly description?: RemixNode
  readonly action?: action
  readonly duration: number
  readonly remaining: number
  readonly paused: boolean
  readonly presented: boolean
  readonly priority: 'low' | 'high'
}
`),
  ToastManager: await highlightSource(`
interface ToastManager<action = RemixNode> extends TypedEventTarget<{ change: Event }> {
  readonly toasts: readonly ToastRecord<action>[]
  add(options: ToastOptions<action>): string
  update(id: string, options: Partial<Omit<ToastOptions<action>, 'id'>>): void
  close(id?: string): void
  pause(reason: unknown): void
  resume(reason: unknown): void
  present(id: string, signal: AbortSignal): void
}
`),
  ToastContextProps: await highlightSource(`
interface ToastContextProps<action = RemixNode> {
  manager: ToastManager<action>
  limit?: number
  children: (toasts: readonly ToastRecord<action>[]) => RemixNode
}
`),
  ToastRootOptions: await highlightSource(`
interface ToastRootOptions {
  label: string
  hotkey?: string | false
}
`),
  ToastItemContextProps: await highlightSource(`
interface ToastItemContextProps<action = RemixNode> {
  toast: ToastRecord<action>
  children?: RemixNode
}
`),
}

export default function ToastPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout
      page={meta}
      pages={handle.props.pages}
      outlet={
        <div class="ui-toast-demo-outlets">
          {basic.Outlet && <basic.Outlet />}
          {undo.Outlet && <undo.Outlet />}
          {actions.Outlet && <actions.Outlet />}
          {updates.Outlet && <updates.Outlet />}
          {stack.Outlet && <stack.Outlet />}
          {timed.Outlet && <timed.Outlet />}
        </div>
      }
    >
      <p>
        Notifications form a compact stack that expands on hover, focus or touch. Swipe right to
        dismiss, drag left to feel resistance, or use the dismiss button. F6 moves focus into the
        stack and back. Escape dismisses the focused notification.
      </p>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>
          Create a manager to publish, update and close notifications. Mount one{' '}
          <code>toast.Context</code> for that manager and render its collection, newest first. Apply{' '}
          <code>root({`{ label }`})</code> to the region and wrap each notification in
          <code>ItemContext</code>. Connect its elements with <code>item()</code>,{' '}
          <code>title()</code>,<code>description()</code> and <code>close()</code>. You supply the
          markup, styles and translated labels.
        </p>
        <CodeBlock html={anatomy} />
        <p id="motion">
          Toast manages timers, announcements and focus. CSS defines the stack and responds to{' '}
          <code>data-expanded</code> during hover, focus or touch. The examples compose{' '}
          <a href="/animation/drag/">drag</a>, <a href="/animation/layout/">layout</a> and{' '}
          <a href="/animation/entrance-exit/">entrance and exit</a> mixins on the toast host. Swipe
          handling calls <code>close()</code> when dismissal commits. CSS owns card sizes and
          positions, including where the region appears.
        </p>
        <CodeBlock html={position} />
        <p>
          Mount the region near the application root. It uses ordinary document stacking and does
          not create a portal or enter the browser's top layer. A clipping ancestor or modal dialog
          can affect its visibility and availability.
        </p>
      </Section>
      <Section id="publishing" title="Publishing from anywhere">
        <p>
          Share a stable manager with any component or utility that publishes notifications. Mount
          its context near the application root so notifications remain available across page
          changes. Keep server-side managers scoped to an application instance or request.
        </p>
        <CodeBlock html={publishers} />
        <p>
          Notifications published before the region mounts are retained. Their timers start when an
          item presents them. Unmounting the region pauses those timers without discarding
          notifications. Remounting resumes them with their remaining time.
        </p>
      </Section>
      <Section id="undo" title="Actions">
        <p>
          Pass a button, link or other renderable content as <code>action</code>. Actions remain
          native controls. Attach handlers with <code>on()</code> and call <code>close()</code>
          when appropriate. An action makes the toast persistent unless you supply a duration.
        </p>
        <Example id="undo-example" example={undo} />
      </Section>
      <Section id="actions" title="Typed actions and links">
        <p>
          The default action type is <code>RemixNode</code>. For a design system, supply your own
          type to <code>createToastManager()</code> and render that data in the context callback.
          The collection infers your action type while keeping the standard toast fields.
        </p>
        <CodeBlock html={typed} />
        <p>
          An action type can also describe multiple controls. Use a discriminated union to render
          buttons and links with their native semantics.
        </p>
        <Example id="multiple-actions" example={actions} />
      </Section>
      <Section id="deduplication" title="Deduplication">
        <p>
          Pass a stable <code>id</code> to <code>add()</code> to update an existing notification
          instead of creating a duplicate. Supplied fields merge into the toast and its timer
          restarts. Its position in the stack stays the same.
        </p>
        <Example id="stack" example={stack} />
        <p>
          Configure <code>limit</code> on <code>toast.Context</code>. The default is three. Overflow
          remains in the collection and in the DOM with <code>data-limited</code>, native inertness
          and <code>aria-hidden</code>. Keep rendering it so your CSS can fade and move it back into
          view. Limited timers continue running.
        </p>
      </Section>
      <Section id="updates" title="Updating a toast">
        <p>
          Use <code>update(id, options)</code> to change an open toast without restarting its timer.
          Supplying a duration starts a fresh lifetime. Updates to a closed toast do nothing.
        </p>
        <p>
          An upload can use one notification throughout its progress. Success updates it with a
          timed confirmation. Failure updates it with a persistent Retry action.
        </p>
        <Example id="upload" example={updates} />
      </Section>
      <Section id="auto-dismiss" title="Timeout and countdown">
        <p>
          Notifications dismiss after five seconds by default. Toasts with actions stay open. Set{' '}
          <code>duration</code> in milliseconds to choose a lifetime, or use{' '}
          <code>duration: 0</code> to keep a toast open until explicitly closed.
        </p>
        <Example id="timed" example={timed} />
        <p id="timers">
          Hover, focus and touch engagement pause timers. So do a hidden document or an unfocused
          window. Add an application pause with <code>pause(reason)</code> and remove it with{' '}
          <code>resume(reason)</code>. Each reason is independent. Resuming one does not override
          another.
        </p>
        <CodeBlock html={timing} />
        <h3>Countdown indicators</h3>
        <p>
          Apply <code>toast.countdown(notification)</code> to a decorative indicator or its wrapper.
          It animates <code>--toast-remaining</code> from 1 to 0. The value inherits into
          descendants, so CSS can use it for a transform, an SVG stroke or a gradient. You supply
          the shape, dimensions, color and placement.
        </p>
        <CodeBlock html={countdownCode} />
        <p>
          The indicator follows the toast's timer, including pauses and restarts. For a five-second
          toast with three seconds remaining, the value starts at 0.6 and reaches zero over three
          seconds. The manager closes the toast when its timer expires.
        </p>
        <p>
          The mixin hides persistent countdowns and marks indicators <code>aria-hidden</code>. Keep
          the wrapper's content decorative. CSS controls its appearance without the mixin setting
          its transform.
        </p>
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Supply the region's accessible name with <code>root({`{ label }`})</code>. Each
          notification is a non-modal dialog. Its heading and supporting content are connected by{' '}
          <code>title()</code> and <code>description()</code>. Both fields accept JSX; the mixins
          belong on the elements you render.
        </p>
        <p>
          Notifications use polite announcements by default. Set <code>priority: 'high'</code>
          for an urgent notification: a separate assertive alert announces its published title and
          description. While the collection has keyboard focus, that copy is removed and the
          notification itself becomes exposed for exploration. Keep meaningful announcement content
          in the published fields; high-priority copies do not include arbitrary extra markup or
          actions.
        </p>
        <p>
          New notifications preserve focus elsewhere on the page. F6 enters the collection, and Tab
          visits each notification before its controls. F6 again, Shift+Tab from the collection, or
          Tab past either boundary returns to the previous element. Escape dismisses the focused
          notification. Closing it moves focus to a neighbouring available notification or restores
          the previous element. The shortcut can be changed or disabled. Make the shortcut
          discoverable in your application and use distinct shortcuts for separate managers.
        </p>
        <p>
          Provide a visible dismiss control. Swiping must not be the only way to dismiss a toast.
          Essential errors and decisions should also be available in the page.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="create-manager">createToastManager&lt;action = RemixNode&gt;()</h3>
        <p>Creates application-level state and commands.</p>
        <h3 id="manager">ToastManager&lt;action&gt;</h3>
        <ApiTable id="manager-members" label="Member">
          <ApiEntry name="toasts" type="readonly ToastRecord<action>[]">
            Current immutable snapshots, newest first. Repeated IDs keep their position.
          </ApiEntry>
          <ApiEntry name="add" type="(options: ToastOptions<action>) => string">
            Publishes <a href="#type-ToastOptions">ToastOptions</a> or merges by ID and restarts its
            lifetime. Returns the generated or supplied ID.
          </ApiEntry>
          <ApiEntry
            name="update"
            type="(id: string, options: Partial<Omit<ToastOptions<action>, 'id'>>) => void"
          >
            Merges into an open record. Only an explicit duration restarts the timer.
          </ApiEntry>
          <ApiEntry name="close" type="(id?: string) => void">
            Closes one record, or all records when omitted.
          </ApiEntry>
          <ApiEntry name="pause" type="(reason: unknown) => void">
            Adds an opaque pause reason. Repeated calls with the same reason are idempotent.
          </ApiEntry>
          <ApiEntry name="resume" type="(reason: unknown) => void">
            Removes only the matching pause reason.
          </ApiEntry>
          <ApiEntry name="present" type="(id: string, signal: AbortSignal) => void">
            Registers a presentation until abort. The last presentation's removal pauses the timer.
            item() calls this for its host lifetime.
          </ApiEntry>
          <ApiEntry name="addEventListener" type="('change', listener, options?) => void">
            <p>
              Native EventTarget subscription with AbortSignal cleanup. Read <code>toasts</code>
              inside the listener for immutable snapshots of the new state.
            </p>
            <CodeBlock html={subscribe} />
          </ApiEntry>
        </ApiTable>
        <h3 id="options">ToastOptions&lt;action = RemixNode&gt;</h3>
        <ApiTable id="toast-options" label="Option" defaults>
          <ApiEntry name="id" type="string" defaultValue="generated">
            Repeated IDs update in place. Generated IDs are unique within the manager.
          </ApiEntry>
          <ApiEntry name="title" type="RemixNode">
            Optional renderable heading. Apply title() to its element.
          </ApiEntry>
          <ApiEntry name="description" type="RemixNode">
            Optional renderable supporting content. Apply description() to its element.
          </ApiEntry>
          <ApiEntry name="action" type="action">
            Native renderable content by default, or consumer-defined typed data. Only null and
            undefined mean no action. Empty strings, false and empty arrays still make a toast
            persistent unless a duration is supplied.
          </ApiEntry>
          <ApiEntry name="duration" type="number" defaultValue="5000, or 0 with an action">
            Finite, non-negative milliseconds. Zero persists. Invalid values throw RangeError.
          </ApiEntry>
          <ApiEntry name="priority" type="'low' | 'high'" defaultValue="'low'">
            Announcement urgency. High priority uses an assertive alert; it does not move focus or
            change duration.
          </ApiEntry>
        </ApiTable>
        <h3 id="record">ToastRecord&lt;action = RemixNode&gt;</h3>
        <p>
          Readonly title, description and action fields match the published content. Other snapshot
          fields follow.
        </p>
        <ApiTable id="toast-record" label="Field">
          <ApiEntry name="id" type="string">
            Stable identity for commands and the host's key.
          </ApiEntry>
          <ApiEntry name="duration" type="number">
            Configured lifetime in milliseconds.
          </ApiEntry>
          <ApiEntry name="remaining" type="number">
            Remaining milliseconds when the snapshot was read.
          </ApiEntry>
          <ApiEntry name="paused" type="boolean">
            True while the timer is stopped, including persistent or unpresented records.
          </ApiEntry>
          <ApiEntry name="presented" type="boolean">
            At least one item currently presents the record.
          </ApiEntry>
          <ApiEntry name="priority" type="'low' | 'high'">
            Resolved announcement urgency.
          </ApiEntry>
        </ApiTable>
        <h3 id="context">Context</h3>
        <ApiTable id="context-props" label="Prop">
          <ApiEntry name="manager" type="ToastManager<action>" required>
            Stable application-level manager. Mount one Context per manager.
          </ApiEntry>
          <ApiEntry name="limit" type="number">
            Maximum available notifications. Defaults to 3. Must be a positive integer; invalid
            values throw RangeError. Overflow remains mounted and inert, and its timers keep
            running.
          </ApiEntry>
          <ApiEntry
            name="children"
            type="(toasts: readonly ToastRecord<action>[]) => RemixNode"
            required
          >
            Complete reactive collection. Own the region element and map every record to a keyed
            item.
          </ApiEntry>
        </ApiTable>
        <h3 id="root">root()</h3>
        <ApiTable id="root-options" label="Option" defaults>
          <ApiEntry name="label" type="string" required>
            Non-empty accessible region name. No fallback is supplied.
          </ApiEntry>
          <ApiEntry name="hotkey" type="string | false" defaultValue="'F6'">
            Unmodified KeyboardEvent.key used to enter and leave the region. False disables it.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="root-attributes" label="Attribute">
          <ApiEntry name="aria-live" type="'polite'">
            Announces ordinary rendered notifications.
          </ApiEntry>
          <ApiEntry name="aria-atomic" type="'false'">
            Announces changes without repeating the whole collection.
          </ApiEntry>
          <ApiEntry name="aria-relevant" type="'additions text'">
            Includes new notifications and text updates.
          </ApiEntry>
          <ApiEntry name="role" type="'region'">
            Landmark for user-initiated keyboard entry.
          </ApiEntry>
          <ApiEntry name="aria-label" type="string">
            The required label option.
          </ApiEntry>
          <ApiEntry name="tabindex" type="-1">
            Programmatically focusable without adding an empty region to the tab order.
          </ApiEntry>
          <ApiEntry name="data-expanded" type="''">
            Present during hover, keyboard focus or touch engagement. A primary touch inside starts
            engagement; releasing or cancelling the gesture keeps it active until a primary touch
            outside. Your styles choose the expanded presentation.
          </ApiEntry>
        </ApiTable>
        <h3 id="item-context">ItemContext</h3>
        <ApiTable id="item-context-props" label="Prop">
          <ApiEntry name="toast" type="ToastRecord&lt;action&gt;" required>
            Current record. Key the provider and animated host by its ID.
          </ApiEntry>
          <ApiEntry name="children" type="RemixNode">
            Consumer-owned notification markup. Nested mixins share this item's scope.
          </ApiEntry>
        </ApiTable>
        <h3 id="content-parts">title(), description(), close()</h3>
        <p>
          Apply <code>title()</code> to the heading and <code>description()</code> to supporting
          content. They register generated or authored IDs with the item and remove relationships
          when their content is empty or the elements disappear. They do not supply elements or
          content. Apply <code>close()</code> to a native button with your translated text or
          accessible label. It dismisses the scoped notification and hides the dismiss control from
          passive announcements while the collection is collapsed. Actions remain ordinary buttons
          and links and do not implicitly dismiss.
        </p>
        <h3 id="item">item()</h3>
        <p>
          Apply to the notification host inside ItemContext. It takes no options. If you omit the
          title, supply an accessible name on the host with <code>aria-label</code> or
          <code>aria-labelledby</code>.
        </p>
        <ApiTable id="item-attributes" label="Attribute">
          <ApiEntry name="role" type="'dialog' | 'alertdialog'">
            Non-modal dialog, or alertdialog for high-priority notifications.
          </ApiEntry>
          <ApiEntry name="aria-labelledby" type="string">
            ID of the registered title element.
          </ApiEntry>
          <ApiEntry name="aria-describedby" type="string">
            ID of the registered description element.
          </ApiEntry>
          <ApiEntry name="aria-modal" type="'false'">
            Notifications do not create a modal interaction.
          </ApiEntry>
          <ApiEntry name="tabindex" type="0">
            Visits the notification before its controls.
          </ApiEntry>
          <ApiEntry name="data-toast" type="''">
            Marks the toast host.
          </ApiEntry>
          <ApiEntry name="inert" type="boolean">
            Applied while limited or logically closed. Retained exits remain unavailable.
          </ApiEntry>
          <ApiEntry name="aria-hidden" type="'true'">
            Applied while limited or logically closed, and to unfocused high-priority notifications.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="item-states" label="Attribute">
          <ApiEntry name="data-limited" type="''">
            Notification is outside the context limit. It remains mounted and inert.
          </ApiEntry>
        </ApiTable>
        <h3 id="countdown">countdown()</h3>
        <p>
          Accepts the record's <code>duration</code>, <code>remaining</code> and <code>paused</code>
          . Animates the inherited CSS custom property <code>--toast-remaining</code> linearly from
          1 to 0, sets <code>aria-hidden="true"</code>, and sets <code>hidden</code> for persistent
          records. Consumer CSS maps the fraction to a decorative indicator. Its native animation
          follows timer changes without per-frame component updates. Animating an inherited custom
          property can still require browser style work each frame.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="toast-types">
          <ApiEntry id="type-ToastOptions" name="ToastOptions" type="interface">
            <p>Content supplied when publishing.</p>
            <CodeBlock html={typeDefinitions.ToastOptions} />
          </ApiEntry>
          <ApiEntry id="type-ToastRecord" name="ToastRecord" type="interface">
            <p>Immutable content and sampled clock state.</p>
            <CodeBlock html={typeDefinitions.ToastRecord} />
          </ApiEntry>
          <ApiEntry id="type-ToastManager" name="ToastManager" type="interface">
            <p>Commands and native state subscriptions.</p>
            <CodeBlock html={typeDefinitions.ToastManager} />
          </ApiEntry>
          <ApiEntry id="type-ToastContextProps" name="ToastContextProps" type="interface">
            <CodeBlock html={typeDefinitions.ToastContextProps} />
          </ApiEntry>
          <ApiEntry id="type-ToastRootOptions" name="ToastRootOptions" type="interface">
            <CodeBlock html={typeDefinitions.ToastRootOptions} />
          </ApiEntry>
          <ApiEntry id="type-ToastItemContextProps" name="ToastItemContextProps" type="interface">
            <p>Per-notification scope and consumer-owned markup.</p>
            <CodeBlock html={typeDefinitions.ToastItemContextProps} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
