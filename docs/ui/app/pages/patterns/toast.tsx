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
  description: 'Toast notifications with accessible interactions and pausable timers.',
  importPath: '@remix-run/ui/toast',
} satisfies PageMeta

const timeout = await loadExample('toast/timeout', { outlet: 'ToastRegion' })
const customPosition = await loadExample('toast/position', { outlet: 'ToastRegion' })
const limit = await loadExample('toast/limit', { outlet: 'ToastRegion' })
const basic = await loadExample('toast/basic', { outlet: 'ToastRegion' })
const action = await loadExample('toast/action', { outlet: 'ToastRegion' })
const stack = await loadExample('toast/stack', { outlet: 'ToastRegion' })
const countdown = await loadExample('toast/countdown', { outlet: 'ToastRegion' })
const dismissal = await loadExample('toast/dismissal', { outlet: 'ToastRegion' })

const anatomy = await highlightSource(`
  import * as toast from '@remix-run/ui/toast'
  import { css } from 'remix/component'

  const toastManager = toast.createToastManager()

  const element = <toast.Context manager={toastManager} limit={3}>
    {toastItems => (
      <section mix={[
        toast.root({ label: 'Notifications' }),
        css({
          '&[data-expanded]': {},
          '&:focus-visible': {},
        }),
      ]}>
        {toastItems.map(toastItem => (
          <toast.ItemContext key={toastItem.id} value={toastItem.id}>
          <article key={toastItem.id} mix={[
            toast.item(),
            css({
              '&[data-limited]': {},
              '&:focus-visible': {},
            }),
          ]}>
            <div>
              <h2 mix={toast.title()}>{toastItem.title}</h2>
              <p mix={toast.description()}>{toastItem.description}</p>
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
  const element = <article mix={toast.item({ countdown: true })}>
    <strong mix={toast.title()}>{toastItem.title}</strong>
    {Boolean(toastItem.timeout) && (
      <div aria-hidden="true" mix={css({
        height: '2px',
        background: 'currentColor',
        transform: 'scaleX(var(--toast-countdown, 1))',
        transformOrigin: 'left',
      })} />
    )}
  </article>
`)

const publishers = await highlightSource(`
  import * as toast from '@remix-run/ui/toast'

  // Share this manager with your region and notification publishers.
  export const toastManager = toast.createToastManager()

  toastManager.add({ title: 'Toast title' })
`)

const subscribe = await highlightSource(`
  let subscription = new AbortController()
  toastManager.addEventListener('change', () => {
    console.log(toastManager.items)
  }, { signal: subscription.signal })

  subscription.abort()
`)

const typeDefinitions = {
  ToastAddOptions: await highlightSource(`
interface ToastAddOptions<data = unknown> {
  id?: string
  title?: RemixNode
  description?: RemixNode
  announcement?: string
  data?: data
  timeout?: number
}
`),
  ToastItem: await highlightSource(`
interface ToastItem<data = unknown> {
  readonly id: string
  readonly revision: number
  readonly title?: RemixNode
  readonly description?: RemixNode
  readonly announcement?: string
  readonly data?: data
  readonly timeout?: number
}
`),
  ToastManager: await highlightSource(`
interface ToastManager<data = unknown> extends TypedEventTarget<{ change: Event }> {
  readonly items: readonly ToastItem<data>[]
  add(options: ToastAddOptions<data>): string
  close(id: string): void
  closeAll(): void
}
`),
  ToastContextProps: await highlightSource(`
interface ToastContextProps<data = unknown> {
  manager: ToastManager<data>
  limit?: number
  children: (toastItems: readonly ToastItem<data>[]) => RemixNode
}
`),
  ToastItemOptions: await highlightSource(`
interface ToastItemOptions {
  countdown?: boolean
}
`),
  ToastRootOptions: await highlightSource(`
interface ToastRootOptions {
  label: string
}
`),
  ToastItemContextProps: await highlightSource(`
interface ToastItemContextProps {
  value: string
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
        <>
          <div class="ui-toast-demo-outlets">
            {basic.Outlet && <basic.Outlet />}
            {limit.Outlet && <limit.Outlet />}
            {action.Outlet && <action.Outlet />}
            {stack.Outlet && <stack.Outlet />}
            {timeout.Outlet && <timeout.Outlet />}
            {countdown.Outlet && <countdown.Outlet />}
            {dismissal.Outlet && <dismissal.Outlet />}
          </div>
          {customPosition.Outlet && <customPosition.Outlet />}
        </>
      }
    >
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomy} />
      </Section>
      <Section id="publishing" title="Managing toasts">
        <p>
          Share a stable manager with any component or utility that publishes notifications. Mount
          its context near the application root so notifications remain available across page
          changes.
        </p>
        <p>
          The manager stores notifications only in the browser. Toasts are not server-rendered.
          Notifications published in the browser before the context hydrates appear after it mounts.
        </p>
        <CodeBlock html={publishers} />
        <p>
          Call <code>close(id)</code> to dismiss a toast programmatically, or{' '}
          <code>closeAll()</code>
          to dismiss all toasts. Use the ID returned by <code>add()</code> or read it from{' '}
          <code>items</code>.
        </p>
        <Example id="programmatic-dismissal" example={dismissal} />
      </Section>
      <Section id="custom-position" title="Custom position">
        <p>Your CSS and render logic define where toasts are rendered and how they are styled.</p>
        <Example id="position" example={customPosition} />
      </Section>
      <Section id="limiting-toasts" title="Limit">
        <p>
          Set <code>limit</code> on <code>toast.Context</code> to control how many toasts are
          available at once. There is no limit by default.
        </p>
        <p>
          Overflow toasts stay mounted with <code>data-limited</code> and are excluded from
          interaction and assistive technology. Keep rendering them so your CSS can fade and move
          them back into view when newer toasts close. Their timers continue running.
        </p>
        <Example id="limit" example={limit} />
      </Section>
      <Section id="auto-dismiss" title="Timeout">
        <p id="timers">
          Set <code>timeout</code> in milliseconds to dismiss a toast automatically. Without a
          timeout, toasts stay open until dismissed. Timers pause during hover, focus or touch
          engagement, and while the document is hidden or the window is unfocused.
        </p>
        <Example id="timeout" example={timeout} />
      </Section>
      <Section id="countdown-indicators" title="Countdown indicators">
        <p>
          Set <code>countdown: true</code> on <code>toast.item()</code> to enable countdown styling.
          It animates <code>--toast-countdown</code> from 1 to 0. Use this value in your indicator's
          CSS. Mark decorative indicators with <code>aria-hidden="true"</code> and only render them
          for toasts with an automatic dismissal timeout.
        </p>
        <Example id="countdown-example" example={countdown} />
        <CodeBlock html={countdownCode} />
      </Section>
      <Section id="action" title="Actions and custom data">
        <p>
          Use data to define custom actions, including their labels and handlers. Your render logic
          decides how to present them to the user.
        </p>
        <p>
          Announcements use the published title and description, excluding controls and other markup
          added by your renderer. Set <code>announcement</code> to replace the entire spoken
          message. Screen reader users cannot activate a toast's actions directly from its
          announcement. Where possible, include an alternative way to perform the action in that
          message, such as a keyboard shortcut or a control elsewhere in your application.
        </p>
        <Example id="action-example" example={action} />
      </Section>
      <Section id="deduplication" title="Replacing a toast">
        <p>
          Pass a stable <code>id</code> to <code>add()</code> to replace an existing notification
          instead of creating a duplicate. Its timer restarts and its position in the stack stays
          the same. Each call replaces the previous content and options.
        </p>
        <p>
          Each replacement increments <code>toastItem.revision</code>. The example uses odd and even
          revisions to alternate between two identical CSS animations, restarting the pulse each
          time.
        </p>
        <Example id="stack" example={stack} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Notifications use polite live announcements. Supply the region's accessible name with{' '}
          <code>root({`{ label }`})</code>. Each notification is a non-modal dialog. Its heading and
          supporting content are connected by <code>title()</code> and <code>description()</code>.
          Both fields accept JSX; the mixins belong on the elements you render.
        </p>
        <p>
          Announcements use the published title and description, excluding action buttons, dismiss
          controls and other markup added by your renderer. Set <code>announcement</code> to replace
          the entire spoken message without changing the visible content.
        </p>
        <p>
          Toast actions are not readily available to screen reader users from a live announcement.
          Where possible, provide an alternative way to perform the action and describe it in{' '}
          <code>announcement</code>, such as a keyboard shortcut or a control elsewhere in your
          application. The toast's controls remain available when users navigate into the
          collection.
        </p>
        <p>
          New notifications preserve focus elsewhere on the page. F6 enters the collection, and Tab
          visits each notification before its controls. F6 again, Shift+Tab from the collection, or
          Tab past either boundary returns to the previous element. Escape dismisses the focused
          notification. Closing it moves focus to a neighbouring available notification or restores
          the previous element. Make the shortcut discoverable in your application.
        </p>
        <p>
          Provide a visible dismiss control. Essential errors and decisions should also be available
          in the page.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="create-manager">createToastManager&lt;data = unknown&gt;()</h3>
        <p>Creates browser notification state and commands.</p>
        <h3 id="manager">ToastManager&lt;data&gt;</h3>
        <ApiTable id="manager-members" label="Member">
          <ApiEntry name="items" type="readonly ToastItem<data>[]">
            Current immutable snapshots, newest first. Repeated IDs keep their position.
          </ApiEntry>
          <ApiEntry name="add" type="(options: ToastAddOptions<data>) => string">
            Publishes <a href="#type-ToastAddOptions">ToastAddOptions</a> or replaces an existing
            ID's content and options and restarts its lifetime. Omitted fields clear or use their
            defaults. Returns the generated or supplied ID.
          </ApiEntry>
          <ApiEntry name="close" type="(id: string) => void">
            Closes the item with the supplied ID.
          </ApiEntry>
          <ApiEntry name="closeAll" type="() => void">
            Closes all items.
          </ApiEntry>
          <ApiEntry name="addEventListener" type="('change', listener, options?) => void">
            <p>
              Native EventTarget subscription with AbortSignal cleanup. Read <code>items</code>
              inside the listener for immutable snapshots of the new state.
            </p>
            <CodeBlock html={subscribe} />
          </ApiEntry>
        </ApiTable>
        <h3 id="options">ToastAddOptions&lt;data = unknown&gt;</h3>
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
          <ApiEntry name="announcement" type="string" defaultValue="title and description">
            Overrides the spoken title and description without changing the visible content.
          </ApiEntry>
          <ApiEntry name="data" type="data">
            Consumer-defined data interpreted by your renderer. Supply a type to
            createToastManager() for typed access.
          </ApiEntry>
          <ApiEntry name="timeout" type="number" defaultValue="none">
            Timeout in non-negative milliseconds. Omit to keep the notification open.
          </ApiEntry>
        </ApiTable>
        <h3 id="toast-item">ToastItem&lt;data = unknown&gt;</h3>
        <p>Readonly notification content and options, with an ID and update revision.</p>
        <ApiTable id="toast-item-fields" label="Field">
          <ApiEntry name="id" type="string">
            Stable identity for commands and the host's key.
          </ApiEntry>
          <ApiEntry name="revision" type="number">
            Starts at zero and increments each time add() replaces the notification.
          </ApiEntry>
          <ApiEntry name="timeout" type="number | undefined">
            The notification's timeout option.
          </ApiEntry>
        </ApiTable>
        <h3 id="context">Context</h3>
        <ApiTable id="context-props" label="Prop">
          <ApiEntry name="manager" type="ToastManager<data>" required>
            Stable application-level manager.
          </ApiEntry>
          <ApiEntry name="limit" type="number">
            Maximum available notifications, as a positive integer. Unlimited by default.
          </ApiEntry>
          <ApiEntry
            name="children"
            type="(toastItems: readonly ToastItem<data>[]) => RemixNode"
            required
          >
            Complete reactive collection. Wrap each toast item in a keyed ItemContext.
          </ApiEntry>
        </ApiTable>
        <h3 id="root">root()</h3>
        <ApiTable id="root-options" label="Option" defaults>
          <ApiEntry name="label" type="string" required>
            Non-empty accessible region name.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="root-attributes" label="Attribute">
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
            Present during hover, keyboard focus or touch engagement. Use it to style the expanded
            collection.
          </ApiEntry>
        </ApiTable>
        <h3 id="item-context">ItemContext</h3>
        <ApiTable id="item-context-props" label="Prop">
          <ApiEntry name="value" type="string" required>
            Toast item ID from the manager. Key the provider and animated host by the same ID.
          </ApiEntry>
          <ApiEntry name="children" type="RemixNode">
            Consumer-owned notification markup. Nested mixins share this item's scope.
          </ApiEntry>
        </ApiTable>
        <h3 id="content-parts">title(), description(), close()</h3>
        <p>
          Apply <code>title()</code> to the heading and <code>description()</code> to supporting
          content. They connect those elements to the notification using generated or authored IDs.
          Apply <code>close()</code> to a native button with your translated text or accessible
          label. It dismisses the scoped notification. Actions remain ordinary buttons and links and
          do not implicitly dismiss.
        </p>
        <h3 id="item">item()</h3>
        <p>
          Apply to the notification host inside ItemContext. If you omit the title, supply an
          accessible name on the host with <code>aria-label</code> or
          <code>aria-labelledby</code>.
        </p>
        <ApiTable id="item-options" label="Option">
          <ApiEntry name="countdown" type="boolean">
            Animates the inherited <code>--toast-countdown</code> fraction from 1 to 0 while the
            timer runs. Defaults to false.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="item-css-variables" label="CSS variable">
          <ApiEntry name="--toast-countdown" type="number">
            Remaining timeout fraction when <code>countdown: true</code> is enabled. Use it to style
            a decorative indicator.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="item-attributes" label="Attribute">
          <ApiEntry name="role" type="'dialog'">
            Non-modal dialog.
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
            Applied to overflow and dismissed notifications.
          </ApiEntry>
          <ApiEntry name="aria-hidden" type="'true'">
            Applied while focus is outside the collection, or to overflow and dismissed
            notifications.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="item-states" label="Attribute">
          <ApiEntry name="data-limited" type="''">
            Notification is outside the context limit. It remains mounted and inert.
          </ApiEntry>
        </ApiTable>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="toast-types">
          <ApiEntry id="type-ToastAddOptions" name="ToastAddOptions" type="interface">
            <p>Content supplied when publishing.</p>
            <CodeBlock html={typeDefinitions.ToastAddOptions} />
          </ApiEntry>
          <ApiEntry id="type-ToastItem" name="ToastItem" type="interface">
            <p>Immutable published content and options.</p>
            <CodeBlock html={typeDefinitions.ToastItem} />
          </ApiEntry>
          <ApiEntry id="type-ToastManager" name="ToastManager" type="interface">
            <p>Commands and native state subscriptions.</p>
            <CodeBlock html={typeDefinitions.ToastManager} />
          </ApiEntry>
          <ApiEntry id="type-ToastContextProps" name="ToastContextProps" type="interface">
            <CodeBlock html={typeDefinitions.ToastContextProps} />
          </ApiEntry>
          <ApiEntry id="type-ToastItemOptions" name="ToastItemOptions" type="interface">
            <CodeBlock html={typeDefinitions.ToastItemOptions} />
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
