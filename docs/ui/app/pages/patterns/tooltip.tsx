import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Tooltip',
  slug: 'tooltip',
  category: 'patterns',
  description: 'Short descriptions that appear on hover and keyboard focus.',
  importPath: '@remix-run/ui/tooltip',
} satisfies PageMeta

const basic = await loadExample('tooltip/basic')
const group = await loadExample('tooltip/group')

const anatomyCode = await highlightSource(`
  import { Portal } from '@remix-run/ui/portal'
  import * as tooltip from '@remix-run/ui/tooltip'
  import { css } from 'remix/component'

  <tooltip.Context>
    <button
      type="button"
      aria-label="Copy link"
      mix={[
        tooltip.trigger(),
        css({
          '&[data-state="open"]': {},
          '&:focus-visible': {},
        }),
      ]}
    >
      <LinkIcon />
    </button>
    <Portal>
      <div
        mix={[
          tooltip.popup({ placement: 'top', offset: 8 }),
          css({
            '&[data-state="open"]': {},
            '&[data-anchor-placement^="bottom"]': {},
            '&[data-instant]': {},
          }),
        ]}
      >
        Copy link
        <span
          mix={[
            tooltip.arrow(),
            css({
              '&[data-side="top"]': {},
            }),
          ]}
        />
      </div>
    </Portal>
  </tooltip.Context>
`)

const delayCode = await highlightSource(`
  <tooltip.Context delay={300} closeDelay={150}>
    {/* trigger and popup */}
  </tooltip.Context>
`)

const groupCode = await highlightSource(`
  <tooltip.GroupContext delay={500} timeout={400}>
    <div role="toolbar" aria-label="Text formatting">
      <BoldButton />
      <ItalicButton />
    </div>
  </tooltip.GroupContext>
`)

const instantCode = await highlightSource(`
  css({
    transition: 'opacity 120ms ease, display 120ms allow-discrete, overlay 120ms allow-discrete',
    '&[data-instant]': { transition: 'none' },
  })
`)

const controlledCode = await highlightSource(`
  <tooltip.Context
    open={open}
    onOpenChange={(nextOpen, reason) => {
      open = nextOpen
      handle.update()
    }}
  >
    {/* trigger and popup */}
  </tooltip.Context>
`)

const arrowCode = await highlightSource(`
  <span
    mix={[
      tooltip.arrow({ padding: 5 }),
      css({
        width: '12px',
        height: '6px',
        background: 'var(--tooltip-bg)',
        clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        '&[data-side="top"]': { top: 'calc(100% - 1px)' },
        '&[data-side="bottom"]': { bottom: 'calc(100% - 1px)', rotate: '180deg' },
      }),
    ]}
  />
`)

const eventCode = await highlightSource(`
  <div
    mix={tooltip.onTooltipOpenChange((event) => {
      analytics.track('tooltip', { open: event.open, reason: event.reason })
    })}
  >
    {/* tooltips */}
  </div>
`)

const typeDefinitions = {
  TooltipContextProps: await highlightSource(
    `export interface TooltipContextProps {
  children?: RemixNode
  closeDelay?: number
  defaultOpen?: boolean
  delay?: number
  disabled?: boolean
  onOpenChange?: (open: boolean, reason: TooltipOpenChangeReason) => void
  open?: boolean
}`,
  ),
  TooltipGroupContextProps: await highlightSource(
    `export interface TooltipGroupContextProps {
  children?: RemixNode
  closeDelay?: number
  delay?: number
  timeout?: number
}`,
  ),
  TooltipOpenChangeReason: await highlightSource(
    `export type TooltipOpenChangeReason =
  | 'trigger-hover'
  | 'trigger-focus'
  | 'trigger-press'
  | 'escape-key'
  | 'outside-press'
  | 'disabled'
  | 'group'`,
  ),
  TooltipPopupOptions: await highlightSource(`export type TooltipPopupOptions = AnchorOptions`),
}

export default function TooltipPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>
          Render a trigger, a popup and an optional arrow inside one <code>Context</code>. Wrap the
          popup in <code>Portal</code>, as with popovers, so ancestors cannot clip it, and apply
          theme variables and typography to the popup itself. The popup joins the shared overlay
          stack: it paints above the dialog or popover that contains its trigger and stays inside a
          modal dialog's focus boundary. Outside clicks still reach that owner, so one click closes
          both. Use <code>data-state</code> for motion; the popup keeps <code>data-open</code> while
          finite exit animations finish.
        </p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="opening" title="Opening and dismissal">
        <p>
          Hovering the trigger with a mouse or pen opens the tooltip after <code>delay</code>.
          Keyboard focus opens it immediately; pointer focus and touch do not. Leaving the trigger
          closes it after <code>closeDelay</code>, unless the pointer is moving onto the popup.
          Blur, Escape, pressing the trigger and pressing outside close it straight away. After a
          press or Escape, the tooltip stays closed until the pointer leaves the trigger or focus
          moves away, so it does not reappear under the user’s cursor.
        </p>
        <CodeBlock html={delayCode} />
        <h3 id="controlled">Controlled state</h3>
        <p>
          Pass <code>open</code> to own the state. <code>onOpenChange</code> receives each request
          with the reason it was made. Use <code>defaultOpen</code> for an uncontrolled initial
          state.
        </p>
        <CodeBlock html={controlledCode} />
      </Section>
      <Section id="groups" title="Groups">
        <p>
          <code>GroupContext</code> shares delays across nested tooltips. Once one is open, moving
          to another trigger opens it instantly and closes the first. The group cools down{' '}
          <code>timeout</code> milliseconds after the last tooltip closes.
        </p>
        <Example
          id="group"
          example={group}
          title="Toolbar"
          description="Hover a button, then move along the toolbar."
        />
        <CodeBlock html={groupCode} />
        <p>
          Opens and closes skipped by a warm group set <code>data-instant</code> on the popup, so
          tooltips can swap without fading.
        </p>
        <CodeBlock html={instantCode} />
      </Section>
      <Section id="arrow" title="Arrow">
        <p>
          <code>arrow()</code> sets the cross-axis offset that points its host at the trigger,
          following flips and viewport shifts, and keeps it <code>padding</code> pixels from the
          popup’s corners. Draw the shape yourself, then place it on the popup edge and orient it
          with <code>data-side</code>. Overlap the popup by a pixel so antialiasing cannot leave a
          seam between the shapes.
        </p>
        <CodeBlock html={arrowCode} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Tooltips are visual-only. Touch users never see them and screen readers do not announce
          them, so the popup has no <code>role</code> and the trigger is not linked to it. Give the
          trigger an accessible name that carries the same information, such as an{' '}
          <code>aria-label</code> matching the tooltip text on an icon button, and expose shortcuts
          with <code>aria-keyshortcuts</code>.
        </p>
        <p>
          Only <code>:focus-visible</code> focus opens the tooltip, Escape dismisses it without
          moving focus and is ignored while an input method is composing text. An open tooltip
          consumes Escape, so a dialog or popover underneath closes on the next press. Returning to
          the window does not reopen it on a focused trigger. Keep content short and
          non-interactive; use a popover for anything users need to read in full or click.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <ApiTable id="context-props" label="Prop" defaults>
          <ApiEntry name="delay" type="number" defaultValue="600">
            Milliseconds to wait before opening on hover. Falls back to the group delay.
          </ApiEntry>
          <ApiEntry name="closeDelay" type="number" defaultValue="0">
            Milliseconds to wait before closing after the pointer leaves.
          </ApiEntry>
          <ApiEntry name="open" type="boolean">
            Controlled open state.
          </ApiEntry>
          <ApiEntry name="defaultOpen" type="boolean" defaultValue="false">
            Initial uncontrolled open state.
          </ApiEntry>
          <ApiEntry
            name="onOpenChange"
            type="(open: boolean, reason: TooltipOpenChangeReason) => void"
          >
            Called for each open or close request.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Prevents opening and closes an open tooltip.
          </ApiEntry>
        </ApiTable>
        <h3 id="group-context-reference">GroupContext</h3>
        <ApiTable id="group-context-props" label="Prop" defaults>
          <ApiEntry name="delay" type="number">
            Default hover delay for nested tooltips.
          </ApiEntry>
          <ApiEntry name="closeDelay" type="number">
            Default close delay for nested tooltips.
          </ApiEntry>
          <ApiEntry name="timeout" type="number" defaultValue="400">
            Milliseconds after the last tooltip closes during which the next one opens instantly.
          </ApiEntry>
        </ApiTable>
        <h3 id="trigger-reference">trigger()</h3>
        <p>Connects hover, keyboard focus, blur and press on its host to the tooltip.</p>
        <ApiTable id="trigger-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="data-state" type="'open' | 'closed'">
            Current state.
          </ApiEntry>
        </ApiTable>
        <h3 id="popup-reference">popup(options)</h3>
        <p>
          Turns its host into the tooltip surface. Accepts all <code>AnchorOptions</code>;{' '}
          <code>placement</code> defaults to <code>'top'</code>.
        </p>
        <ApiTable id="popup-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="data-open" type="present | absent">
            Present while the popup is shown, including during exit animations.
          </ApiEntry>
          <ApiEntry name="tabindex" type="-1">
            Lets focus rest in the popup, such as when it is clicked, without closing it.
          </ApiEntry>
          <ApiEntry name="data-state" type="'open' | 'closed'">
            Current state.
          </ApiEntry>
          <ApiEntry name="data-instant" type="''">
            Present when a warm group opened or closed the tooltip without delay.
          </ApiEntry>
          <ApiEntry name="data-anchor-placement" type="string">
            Final placement after flipping.
          </ApiEntry>
        </ApiTable>
        <h3 id="arrow-reference">arrow(options)</h3>
        <p>
          Sets <code>left</code> for top and bottom placements, or <code>top</code> for left and
          right placements. Adds <code>aria-hidden="true"</code> and <code>position: absolute</code>
          .
        </p>
        <ApiTable id="arrow-options" label="Option" defaults>
          <ApiEntry name="padding" type="number" defaultValue="5">
            Minimum distance between the arrow and the popup’s edges.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="arrow-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="data-side" type="'top' | 'bottom' | 'left' | 'right'">
            Side of the trigger the popup is on.
          </ApiEntry>
          <ApiEntry name="data-uncentered" type="''">
            Present when padding keeps the arrow from pointing at the trigger’s center.
          </ApiEntry>
        </ApiTable>
        <h3 id="on-tooltip-open-change-reference">onTooltipOpenChange(handler)</h3>
        <p>
          Listens for the bubbling <code>TooltipOpenChangeEvent</code> dispatched from the trigger.
        </p>
        <CodeBlock html={eventCode} />
        <ApiTable id="open-change-event-properties" label="Property">
          <ApiEntry name="open" type="boolean">
            Requested state.
          </ApiEntry>
          <ApiEntry name="reason" type="TooltipOpenChangeReason">
            What caused the request.
          </ApiEntry>
        </ApiTable>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-TooltipContextProps" name="TooltipContextProps" type="interface">
            <p>Provider props for one tooltip.</p>
            <CodeBlock html={typeDefinitions.TooltipContextProps} />
          </ApiEntry>
          <ApiEntry
            id="type-TooltipGroupContextProps"
            name="TooltipGroupContextProps"
            type="interface"
          >
            <p>Shared delay configuration.</p>
            <CodeBlock html={typeDefinitions.TooltipGroupContextProps} />
          </ApiEntry>
          <ApiEntry id="type-TooltipOpenChangeReason" name="TooltipOpenChangeReason" type="type">
            <p>Reason supplied with each open change.</p>
            <CodeBlock html={typeDefinitions.TooltipOpenChangeReason} />
          </ApiEntry>
          <ApiEntry id="type-TooltipPopupOptions" name="TooltipPopupOptions" type="type">
            <p>Positioning options accepted by popup().</p>
            <CodeBlock html={typeDefinitions.TooltipPopupOptions} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
