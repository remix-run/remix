import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Dialog',
  slug: 'dialog',
  category: 'patterns',
  description:
    'Modal and non-modal dialogs with focus management, cancelable dismissal and nesting support.',
  importPath: '@remix-run/ui/dialog',
} satisfies PageMeta

const basic = await loadExample('dialog/basic')
const nonModal = await loadExample('dialog/non-modal')
const trapFocus = await loadExample('dialog/trap-focus')
const nested = await loadExample('dialog/nested')
const preventingDismissal = await loadExample('dialog/preventing-dismissal')
const imperative = await loadExample('dialog/imperative')
const initialFocus = await loadExample('dialog/initial-focus')
const toast = await loadExample('dialog/toast')
const anatomyCode = await highlightSource(`
  import * as dialog from '@remix-run/ui/dialog'
  import { css } from 'remix/component'

  <dialog.Context>
    <button
      mix={[
        dialog.trigger(),
        css({
          '&[data-state="open"]': {},
          '&[data-state="closed"]': {},
          '&:disabled': {},
        }),
      ]}
    >
      Trigger text
    </button>
    <dialog.Portal>
      <div
        mix={[
          dialog.backdrop(),
          css({
            '&[data-state="open"]': {},
            '&[data-state="closed"]': {},
          }),
        ]}
      />
      <dialog.SurfaceContext>
        <section
          mix={[
            dialog.surface(),
            dialog.onDialogChange((event) => {
              handleOpenChange(event.open)
            }),
            css({
              '&[data-state="open"]': {},
              '&[data-state="closed"]': {},
              '&[data-nested]': {},
            }),
          ]}
        >
          <h2 mix={dialog.title()}>Dialog title</h2>
          <p mix={dialog.description()}>Dialog description</p>
          <input aria-label="Field label" mix={dialog.focusOnShow()} />
          <button mix={dialog.close()}>Close</button>
        </section>
      </dialog.SurfaceContext>
    </dialog.Portal>
  </dialog.Context>
`)
const controlledCode = await highlightSource(`
  <dialog.Context
    open={open}
    onOpenChange={(nextOpen) => {
      open = nextOpen
      handle.update()
    }}
  >
    {children}
  </dialog.Context>
`)
const defaultOpenCode = await highlightSource(`
  <dialog.Context defaultOpen>
    {/* Dialog parts */}
  </dialog.Context>
`)
const typeDefinitions = {
  DialogModal: await highlightSource(`type DialogModal = boolean | 'trap-focus'`),
  DialogFocusTarget: await highlightSource(`type DialogFocusTarget =
  | HTMLElement
  | boolean
  | null
  | (() => HTMLElement | boolean | null | undefined)`),
  DialogChangeReason: await highlightSource(`type DialogChangeReason =
  | 'trigger'
  | 'close'
  | 'escape-key'
  | 'outside-click'
  | 'focus-out'
  | 'programmatic'`),
  DialogRef: await highlightSource(`type DialogRef = {
  readonly open: boolean
  show(trigger?: HTMLElement): void
  close(): void
}`),
}

export default function DialogPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="state" title="State">
        <p>
          For controlled state, supply <code>open</code> and accept changes through{' '}
          <code>onOpenChange</code>.
        </p>
        <CodeBlock html={controlledCode} />
        <p>
          To begin with an uncontrolled dialog open, supply <code>defaultOpen</code>.
        </p>
        <CodeBlock html={defaultOpenCode} />
      </Section>
      <Section id="initial-focus" title="Initial focus">
        <p>
          Apply <code>focusOnShow()</code> to choose which control receives focus when the dialog
          opens. For example, focus Cancel so pressing Enter immediately does not confirm an action.
        </p>
        <Example id="initial-focus-example" example={initialFocus} />
      </Section>
      <Section id="unsaved-changes" title="Preventing dismissal">
        <p>
          Closing requests are cancelable. Call <code>event.preventDefault()</code> in{' '}
          <code>onOpenChange</code> or an <code>onDialogChange()</code> listener to keep the dialog
          open, for example when there are unsaved changes.
        </p>
        <Example id="unsaved-changes-example" example={preventingDismissal} />
      </Section>
      <Section id="non-modal" title="Non-modal">
        <p>
          Use <code>{'modal={false}'}</code> when the dialog and page should both remain
          interactive. Set <code>{'closeOnOutsideClick={false}'}</code> to keep the dialog open
          while interacting with the page.
        </p>
        <Example id="non-modal-example" example={nonModal} />
      </Section>
      <Section id="imperative" title="Imperative control">
        <p>
          Use the context's <code>ref</code> to open or close a dialog from your own event handlers.
          Pass the opening control to <code>show(opener)</code> so focus returns to it when the
          dialog closes.
        </p>
        <Example id="imperative-example" example={imperative} />
      </Section>
      <Section id="trap-focus" title="Focus trapping without blocking pointers">
        <p>
          <code>modal="trap-focus"</code> keeps focus inside the dialog while allowing page
          scrolling and outside pointer interaction.
        </p>
        <p>
          This mode still hides background content from assistive technology. Choose non-modal
          behavior when keyboard and screen reader users need to move freely between both areas.
        </p>
        <Example id="trap-focus-example" example={trapFocus} />
      </Section>
      <Section id="composition" title="Nesting">
        <p>Put a child dialog context inside its parent's surface.</p>
        <Example id="nested-example" example={nested} />
      </Section>
      <Section id="toasts" title="Stacking with other patterns">
        <p>
          The stacking of dialogs with other patterns from Remix UI is handled automatically. Follow
          the <a href="/#stacking">stacking and overlays guidance</a> to configure its initial{' '}
          <code>z-index</code> and to place notifications and custom DOM content above dialogs.
        </p>
        <Example id="toast-example" example={toast} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Provide a title or an explicit accessible name. Modal dialogs trap keyboard focus, make
          background content inert and lock page scrolling. <code>modal="trap-focus"</code> retains
          the focus boundary while allowing outside pointer interaction and scrolling.{' '}
          <code>{'modal={false}'}</code> allows both and requests closing when focus leaves.
        </p>
        <p>
          Opening focuses the registered target, first tabbable element or surface. Closing returns
          focus to the opener. Use <code>initialFocus</code> and <code>finalFocus</code> to
          customize these targets. For alert dialogs, author <code>role="alertdialog"</code>. An
          unrelated third-party popup does not automatically join modal focus or dismissal
          coordination.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <ApiTable id="context-options" label="Option" defaults>
          <ApiEntry name="children" type="RemixNode">
            Dialog parts and app-owned content.
          </ApiEntry>
          <ApiEntry name="open" type="boolean">
            Controlled open state.
          </ApiEntry>
          <ApiEntry name="defaultOpen" type="boolean" defaultValue="false">
            Initial uncontrolled state.
          </ApiEntry>
          <ApiEntry name="modal" type="boolean | 'trap-focus'" defaultValue="true">
            Focus and background interaction behavior.
          </ApiEntry>
          <ApiEntry name="closeOnEscape" type="boolean" defaultValue="true">
            Allows Escape to request closing.
          </ApiEntry>
          <ApiEntry name="closeOnOutsideClick" type="boolean" defaultValue="true">
            Allows outside clicks and nonmodal focus departure to request closing.
          </ApiEntry>
          <ApiEntry name="onOpenChange" type="(open: boolean, event: DialogChangeEvent) => void">
            Receives cancelable state requests.
          </ApiEntry>
          <ApiEntry name="onOpenChangeComplete" type="(open: boolean) => void">
            Runs after finite transition and animation completion.
          </ApiEntry>
          <ApiEntry name="ref" type="(dialog: DialogRef) => void">
            Receives a stable ref with readonly open, show(trigger?) and close().
          </ApiEntry>
        </ApiTable>
        <h3 id="portal-reference">Portal</h3>
        <p>
          Use <code>dialog.Portal</code> to render outside clipping ancestors. Keep{' '}
          <code>dialog.SurfaceContext</code> inside it. Omit the Portal for inline rendering.
        </p>
        <ApiTable id="portal-options" label="Prop" defaults>
          <ApiEntry name="children" type="RemixNode">
            The surface context and its content.
          </ApiEntry>
          <ApiEntry name="container" type="HTMLElement | null" defaultValue="document.body">
            Destination in the same document. Changing it remounts the content and resets its local
            state.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="portal-types">
          <ApiEntry id="type-DialogPortalProps" name="DialogPortalProps" type="type">
            Children and container props accepted by dialog.Portal.
          </ApiEntry>
        </ApiTable>
        <h3 id="surface-context-reference">SurfaceContext</h3>
        <p>
          Wrap the element with <code>dialog.surface()</code> in <code>dialog.SurfaceContext</code>{' '}
          within the same <code>dialog.Context</code>. Keep it inside{' '}
          <a href="#portal-reference">dialog.Portal</a> when portaled.
        </p>
        <ApiTable id="surface-context-options" label="Option">
          <ApiEntry name="children" type="RemixNode">
            One dialog surface and its content.
          </ApiEntry>
        </ApiTable>
        <h3 id="parts-reference">Role mixins</h3>
        <ApiTable id="parts" label="Mixin">
          <ApiEntry name="trigger()" type="button mixin">
            Toggles state and records the opener. Disabled buttons do not toggle.
          </ApiEntry>
          <ApiEntry name="surface(options?)" type="element mixin">
            Registers one dialog surface within SurfaceContext, applies role and labeling, and
            manages focus.
          </ApiEntry>
          <ApiEntry name="backdrop()" type="element mixin">
            Registers an optional fixed backdrop beside the surface.
          </ApiEntry>
          <ApiEntry name="close()" type="button mixin">
            Requests closing. Defaults to type="button".
          </ApiEntry>
          <ApiEntry name="title(), description()" type="element mixins">
            Associate a heading and description with the dialog.
          </ApiEntry>
          <ApiEntry name="focusOnShow(), focusOnHide()" type="element mixins">
            Register opening and closing focus targets.
          </ApiEntry>
        </ApiTable>
        <h3 id="focus-reference">Surface focus options</h3>
        <ApiTable id="focus-options" label="Option">
          <ApiEntry name="initialFocus, finalFocus" type="DialogFocusTarget">
            <p>
              Accept an element, boolean, null or a callback returning a target. Use{' '}
              <code>initialFocus</code> to choose where focus moves on opening and{' '}
              <code>finalFocus</code> to choose where it moves on closing. The{' '}
              <code>focusOnShow()</code> and <code>focusOnHide()</code> mixins register these
              targets without element references.
            </p>
            <p>
              Set <code>initialFocus: false</code> when your own code handles opening focus. Set{' '}
              <code>finalFocus: false</code> when your closing action handles focus or navigates
              away. These options skip automatic focus movement without disabling modal focus
              trapping. True, null and undefined use the defaults.
            </p>
            <p>
              By default, closing returns focus to the opener. Choose a different{' '}
              <code>finalFocus</code> target when the opener disappears or the next task is
              elsewhere, such as focusing an item created by the dialog.
            </p>
          </ApiEntry>
        </ApiTable>
        <h3 id="events-reference">DialogChangeEvent</h3>
        <p>
          <code>onDialogChange(handler, captureBoolean?)</code> listens for{' '}
          <code>rmx:dialog-change</code> on the surface's DOM ancestors. With a portal, attach the
          listener inside it or use <code>onOpenChange</code> on <code>dialog.Context</code>. Call{' '}
          <code>preventDefault()</code> to veto a request.
        </p>
        <ApiTable id="event-properties" label="Property">
          <ApiEntry name="open" type="boolean">
            Requested state.
          </ApiEntry>
          <ApiEntry name="reason" type="DialogChangeReason">
            Trigger, close, escape-key, outside-click, focus-out or programmatic.
          </ApiEntry>
          <ApiEntry name="sourceEvent" type="Event | undefined">
            Original browser event when one caused the request.
          </ApiEntry>
        </ApiTable>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types">
          <ApiEntry id="type-DialogModal" name="DialogModal" type="type">
            <p>Supported modal behavior.</p>
            <CodeBlock html={typeDefinitions.DialogModal} />
          </ApiEntry>
          <ApiEntry id="type-DialogFocusTarget" name="DialogFocusTarget" type="type">
            <p>Focus target or automatic focus policy.</p>
            <CodeBlock html={typeDefinitions.DialogFocusTarget} />
          </ApiEntry>
          <ApiEntry id="type-DialogChangeReason" name="DialogChangeReason" type="type">
            <p>Interaction requesting a change.</p>
            <CodeBlock html={typeDefinitions.DialogChangeReason} />
          </ApiEntry>
          <ApiEntry id="type-DialogRef" name="DialogRef" type="type">
            <p>Imperative access to state and opening or closing requests.</p>
            <CodeBlock html={typeDefinitions.DialogRef} />
          </ApiEntry>
          <ApiEntry
            id="type-DialogSurfaceContextProps"
            name="DialogSurfaceContextProps"
            type="type"
          >
            Children accepted by SurfaceContext.
          </ApiEntry>
          <ApiEntry id="type-DialogContextProps" name="DialogContextProps" type="type">
            State, interaction callbacks and children accepted by Context.
          </ApiEntry>
          <ApiEntry id="type-DialogSurfaceOptions" name="DialogSurfaceOptions" type="type">
            Optional initialFocus and finalFocus targets accepted by surface().
          </ApiEntry>
        </ApiTable>
        <h3 id="attributes-reference">Styling attributes</h3>
        <ApiTable id="attributes" label="Attribute">
          <ApiEntry name="data-state" type="open | closed">
            Requested state on triggers, surfaces and backdrops. Use it for motion.
          </ApiEntry>
          <ApiEntry name="data-open" type="present | absent">
            Surface and backdrop visibility, including exit motion.
          </ApiEntry>
          <ApiEntry name="data-nested" type="present | absent">
            Identifies a nested surface.
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
