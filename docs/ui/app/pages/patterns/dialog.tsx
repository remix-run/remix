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
  description: 'Custom dialogs with focus management, nested dismissal and app-owned markup.',
  importPath: '@remix-run/ui/dialog',
} satisfies PageMeta

const basic = await loadExample('dialog/basic')
const anatomyCode = await highlightSource(`
  import * as dialog from '@remix-run/ui/dialog'
  import { Portal } from '@remix-run/ui/portal'
  import { css } from 'remix/component'

  <dialog.Context>
    <button mix={dialog.trigger()}>Trigger text</button>
    <Portal>
      <div mix={[dialog.backdrop(), css({
        '&[data-state="open"]': {},
        '&[data-state="closed"]': {},
      })]} />
      <section mix={[dialog.surface(), css({
        '&[data-state="open"]': {},
        '&[data-state="closed"]': {},
        '&[data-nested]': {},
      })]}>
        <h2 mix={dialog.title()}>Dialog title</h2>
        <p mix={dialog.description()}>Dialog description</p>
        <input aria-label="Field label" mix={dialog.focusOnShow()} />
        <button mix={dialog.close()}>Close</button>
      </section>
    </Portal>
  </dialog.Context>
`)
const controlledCode = await highlightSource(`
  <dialog.Context
    open={open}
    onOpenChange={(nextOpen, event) => {
      if (!nextOpen && hasUnsavedChanges) {
        event.preventDefault()
        return
      }
      open = nextOpen
      handle.update()
    }}
  >
    {children}
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
      <Section id="state" title="State and dismissal">
        <p>
          Use <code>defaultOpen</code> for uncontrolled state, or supply <code>open</code> and
          accept changes through <code>onOpenChange</code>. A change request is cancelable. Closing
          waits for finite surface and backdrop animations before releasing focus and scroll
          locking.
        </p>
        <CodeBlock html={controlledCode} />
      </Section>
      <Section id="composition" title="Nesting and placement">
        <p>
          Put a child dialog context inside its parent's surface. Escape and outside clicks dismiss
          the topmost dialog, menu, select, combobox or popover first. Release Escape before
          dismissing the next layer. Closing an owner also closes its nested layers.
        </p>
        <p>
          Surfaces are ordinary DOM elements. Use <code>Portal</code> to escape clipping and
          transformed ancestors. Apply theme variables and typography to the portaled content. The
          shared stack puts each backdrop below its dialog. Set <code>--rmx-layer-base</code>
          on the document root to offset the stack relative to application chrome.
        </p>
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
        <h3 id="parts-reference">Role mixins</h3>
        <ApiTable id="parts" label="Mixin">
          <ApiEntry name="trigger()" type="button mixin">
            Toggles state and records the opener. Disabled buttons do not toggle.
          </ApiEntry>
          <ApiEntry name="surface(options?)" type="element mixin">
            Registers one dialog surface, applies role and labeling, and manages focus.
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
            Accept an element, boolean, null or a callback returning a target. False disables
            automatic focus movement; true, null and undefined use the defaults.
          </ApiEntry>
        </ApiTable>
        <h3 id="events-reference">DialogChangeEvent</h3>
        <p>
          <code>onDialogChange(handler, captureBoolean?)</code> listens for{' '}
          <code>rmx:dialog-change</code> on the surface's DOM ancestors. With a portal, attach the
          listener inside it or use the context callback. Call <code>preventDefault()</code> to veto
          a request.
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
