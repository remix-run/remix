import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Accordion',
  slug: 'accordion',
  category: 'patterns',
  description: 'Expandable sections with keyboard navigation.',
  importPath: '@remix-run/ui/accordion',
} satisfies PageMeta

const basic = await loadExample('accordion/basic')
const multiple = await loadExample('accordion/multiple')
const controlledSingle = await loadExample('accordion/controlled-single')
const controlledMultiple = await loadExample('accordion/controlled-multiple')
const nonCollapsible = await loadExample('accordion/non-collapsible')
const disabledExample = await loadExample('accordion/disabled')
const disabledItem = await loadExample('accordion/disabled-item')

const anatomyCode = await highlightSource(`
  import * as accordion from '@remix-run/ui/accordion'
  import { css } from 'remix/component'

  <accordion.Context>
    <div mix={[
      accordion.root(),
      css({
        '&[data-type="single"]': {},
        '&[data-type="multiple"]': {},
        '&[data-disabled]': {},
      }),
    ]}>
      <accordion.ItemContext value="item-value">
        <section mix={[
          accordion.item(),
          css({
            '&[data-state="open"]': {},
            '&[data-state="closed"]': {},
            '&[data-disabled]': {},
          }),
        ]}>
          <h3>
            <button type="button" mix={[
              accordion.trigger(),
              css({
                '&[data-state="open"]': {},
                '&[data-state="closed"]': {},
                '&:focus-visible': {},
                '&:disabled': {},
                '&[aria-disabled]': {},
              }),
            ]}>
              Trigger text
            </button>
          </h3>
          <div mix={[
            accordion.content(),
            css({
              '&[data-state="open"]': {},
              '&[data-state="closed"]': {},
            }),
          ]}>
            Panel content
          </div>
        </section>
      </accordion.ItemContext>
    </div>
  </accordion.Context>
`)

const eventsCode = await highlightSource(`
  <div mix={accordion.onAccordionChange((event) => {
    saveOpenPanels(event.value)
  })}>
    {/* Accordion */}
  </div>
`)

const typeDefinitions = {
  AccordionType: await highlightSource(`export type AccordionType = 'single' | 'multiple'`),
  AccordionSingleValue: await highlightSource(`export type AccordionSingleValue = string | null`),
  AccordionMultipleValue: await highlightSource(`export type AccordionMultipleValue = string[]`),
  AccordionValue: await highlightSource(`export type AccordionValue = string | null | string[]`),
  AccordionBaseContextProps: await highlightSource(`export interface AccordionBaseContextProps {
  children?: RemixNode
  disabled?: boolean
}`),
  AccordionSingleContextProps:
    await highlightSource(`export interface AccordionSingleContextProps extends AccordionBaseContextProps {
  type?: 'single'
  value?: AccordionSingleValue
  defaultValue?: AccordionSingleValue
  onValueChange?: (value: AccordionSingleValue) => void
  collapsible?: boolean
}`),
  AccordionMultipleContextProps:
    await highlightSource(`export interface AccordionMultipleContextProps extends AccordionBaseContextProps {
  type: 'multiple'
  value?: AccordionMultipleValue
  defaultValue?: AccordionMultipleValue
  onValueChange?: (value: AccordionMultipleValue) => void
}`),
  AccordionContextProps: await highlightSource(
    `export type AccordionContextProps = AccordionSingleContextProps | AccordionMultipleContextProps`,
  ),
  AccordionItemOptions: await highlightSource(`export interface AccordionItemOptions {
  disabled?: boolean
  value: string
}`),
  AccordionTriggerOptions: await highlightSource(`export interface AccordionTriggerOptions {
  disabled?: boolean
}`),
}

export const preview = basic

export default function AccordionPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="multiple-state" title="Multiple open panels">
        <p>
          Set <code>type="multiple"</code> to open and close panels independently, allowing several
          to stay open at once.
        </p>
        <Example id="multiple" example={multiple} />
      </Section>
      <Section id="state" title="Controlled state">
        <p>
          Pass <code>value</code> and update it in <code>onValueChange</code> to control open
          panels. Without <code>value</code>, the accordion manages its own state, with{' '}
          <code>defaultValue</code> setting which panels start open.
        </p>
        <Example
          id="controlled-single"
          example={controlledSingle}
          title="Controlled single value"
          description="Use an item identifier to open one panel or null to close all panels."
        />
        <Example
          id="controlled-multiple"
          example={controlledMultiple}
          title="Controlled multiple values"
          description="Use an array of open item identifiers or an empty array to close all panels."
        />
      </Section>
      <Section id="collapsing" title="Preventing collapse">
        <p>
          In single mode, <code>{'collapsible={false}'}</code> keeps the selected panel open. Its
          trigger stays focusable. Another enabled trigger can select a different panel.
        </p>
        <Example id="non-collapsible" example={nonCollapsible} />
      </Section>
      <Section id="events" title="Change events">
        <p>
          Use <code>onAccordionChange()</code> on the root or an ancestor to observe changes through
          a bubbling event. Use <code>onValueChange</code> on Context to manage state. In controlled
          mode, both report the requested value.
        </p>
        <CodeBlock html={eventsCode} />
      </Section>
      <Section id="disabled" title="Disabled state">
        <p>
          Disable the whole accordion with <code>Context disabled</code>, or one item with{' '}
          <code>ItemContext disabled</code>. Disabled items are skipped during keyboard navigation.
          Disabling an item preserves its open state.
        </p>
        <Example id="disabled-example" example={disabledExample} title="Disabling the accordion" />
        <Example id="disabled-item" example={disabledItem} title="Disabling one item" />
      </Section>
      <Section id="accessibility" title="Accessibility and keyboard navigation">
        <p>
          Put each trigger button inside a heading whose level fits the surrounding document. For
          substantial panel content, add <code>role="region"</code> to the element using{' '}
          <code>content()</code>. Its generated <code>aria-labelledby</code> names the region from
          the trigger. Reserve regions for panels that benefit from landmark navigation rather than
          adding one to every short answer.
        </p>
        <p>
          The primitive generates the trigger and panel IDs and connects them with{' '}
          <code>aria-controls</code> and <code>aria-labelledby</code>. It updates{' '}
          <code>aria-expanded</code> on the trigger and hides closed panels from assistive
          technology.
        </p>
        <ul>
          <li>Enter and Space activate a native trigger button.</li>
          <li>Arrow Down and Arrow Up move through enabled items and wrap at either end.</li>
          <li>Home and End focus the first and last enabled triggers.</li>
          <li>Tab follows the document's normal focus order. Disabled items are skipped.</li>
        </ul>
        <p>
          Closed panels are inert, so their descendants cannot receive focus. Locked-open triggers
          stay focusable but cannot close their panels. Keep focus indicators visible, hide
          decorative icons from screen readers and respect reduced motion in your styles.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <p>
          Provides open state, mode and disabled state to descendant items. Renders its children
          without adding an element. Single mode opens one panel at a time by default.
        </p>
        <ApiTable id="context-props" label="Prop" defaults>
          <ApiEntry name="type" type="'single' | 'multiple'" defaultValue="'single'">
            Determines whether one or several panels can be open.
          </ApiEntry>
          <ApiEntry name="value" type="string | null | string[]">
            <p>
              Omitted for uncontrolled state. Providing a value makes state controlled.{' '}
              <code>null</code> or <code>[]</code> closes all panels.
            </p>
            <p>
              Single mode uses <a href="#type-AccordionSingleValue">AccordionSingleValue</a>.
              Multiple mode uses <a href="#type-AccordionMultipleValue">AccordionMultipleValue</a>.
            </p>
          </ApiEntry>
          <ApiEntry name="defaultValue" type="string | null | string[]" defaultValue="null or []">
            <p>
              Sets the starting state without making it controlled. Defaults to null in single mode
              or an empty array in multiple mode. Ignored when value is provided. Later changes to
              defaultValue do not reset state.
            </p>
            <p>
              Single mode uses <a href="#type-AccordionSingleValue">AccordionSingleValue</a>.
              Multiple mode uses <a href="#type-AccordionMultipleValue">AccordionMultipleValue</a>.
            </p>
          </ApiEntry>
          <ApiEntry
            name="onValueChange"
            type="(value: string | null) => void (single) or (value: string[]) => void (multiple)"
          >
            Called with the next value requested by a trigger, in either state mode. In controlled
            mode, update your value to accept it.
          </ApiEntry>
          <ApiEntry name="collapsible" type="boolean (single only)" defaultValue="true">
            When false, the selected trigger cannot close its panel. Does not select an initial
            panel or prevent your application changing a controlled value.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Disables all items without changing the open value.
          </ApiEntry>
          <ApiEntry name="children" type="RemixNode">
            Optional content rendered inside the provider.
          </ApiEntry>
        </ApiTable>
        <p>
          Descendants can read <code>handle.context.get(accordion.Context)</code> during render.
        </p>
        <ApiTable id="context-state" label="Provided member">
          <ApiEntry name="type" type="'single' | 'multiple'">
            Current accordion mode.
          </ApiEntry>
          <ApiEntry name="collapsible" type="boolean">
            Whether an open panel can be closed by its trigger. Always true in multiple mode.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean">
            Provider disabled state.
          </ApiEntry>
          <ApiEntry name="isOpen" type="(value: string) => boolean">
            Checks whether an item value is open.
          </ApiEntry>
        </ApiTable>
        <h3 id="root-reference">root()</h3>
        <p>
          Apply to one container inside Context. Takes no options. Change events bubble from this
          element.
        </p>
        <ApiTable id="root-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="data-type" type="'single' | 'multiple'">
            Reflects Context's mode. Always present.
          </ApiEntry>
          <ApiEntry name="data-disabled" type="Empty string or absent">
            Present when Context is disabled. Select with <code>[data-disabled]</code>.
          </ApiEntry>
        </ApiTable>
        <h3 id="item-context-reference">ItemContext</h3>
        <p>
          Provides state for one item inside Context. Renders its children without adding an
          element.
        </p>
        <ApiTable id="item-context-props" label="Prop" defaults>
          <ApiEntry name="value" type="string" required>
            Identifier, unique within the accordion. Used in open values and change events.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Disables this item and excludes it from arrow-key navigation. An item also inherits a
            disabled Context. Its open state is preserved.
          </ApiEntry>
          <ApiEntry name="children" type="RemixNode">
            Optional content rendered inside the provider.
          </ApiEntry>
        </ApiTable>
        <h4 id="item-state-reference">Provided state</h4>
        <p>
          Read <code>handle.context.get(accordion.ItemContext)</code> inside the provider. Its
          readonly properties reflect the current item state. Read them during render.
        </p>
        <ApiTable id="item-state-properties" label="Property">
          <ApiEntry name="value" type="string">
            The item's identifier.
          </ApiEntry>
          <ApiEntry name="open" type="boolean">
            Whether the accordion's open value includes this item.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean">
            Whether Context or ItemContext disables this item. Trigger-only disabling does not
            change it.
          </ApiEntry>
          <ApiEntry name="lockedOpen" type="boolean">
            Whether this item is open in single mode with collapsible false.
          </ApiEntry>
          <ApiEntry name="triggerId, panelId" type="string">
            Generated IDs used by the trigger and content mixins to connect the elements.
          </ApiEntry>
        </ApiTable>
        <h3 id="item-reference">item()</h3>
        <p>
          Apply to a wrapper inside ItemContext. Takes no options. Decorates it with state
          attributes for selectors in <code>css()</code>.
        </p>
        <ApiTable id="item-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="data-state" type="'open' | 'closed'">
            Reflects whether this item is open. Always present.
          </ApiEntry>
          <ApiEntry name="data-disabled" type="Empty string or absent">
            Present when Context or ItemContext disables this item. Select with{' '}
            <code>[data-disabled]</code>.
          </ApiEntry>
        </ApiTable>
        <h3 id="trigger-reference">trigger(options?)</h3>
        <p>
          Apply to a native button inside ItemContext. Handles activation and{' '}
          <a href="#accessibility">keyboard navigation</a>, and connects the button to its panel.
        </p>
        <ApiTable id="trigger-options" label="Option" defaults>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Prevents activation. A native disabled prop on the button has the same effect.
          </ApiEntry>
        </ApiTable>
        <p>
          A disabled item also disables its trigger. Trigger-only disabling prevents activation but
          does not exclude the item from arrow-key navigation. Use ItemContext disabled when the
          item should be skipped.
        </p>
        <h4>Element attributes</h4>
        <ApiTable id="element-attributes-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="id" type="string">
            Generated trigger ID.
          </ApiEntry>
          <ApiEntry name="aria-controls" type="string">
            The panel ID.
          </ApiEntry>
          <ApiEntry name="aria-expanded" type="'true' | 'false'">
            Reflects whether the panel is open.
          </ApiEntry>
          <ApiEntry name="aria-disabled" type="'true' or absent">
            Present when the selected panel is locked open. The trigger remains focusable.
          </ApiEntry>
          <ApiEntry name="disabled" type="Present or absent">
            Present when the item, trigger option or native button prop disables the trigger.
          </ApiEntry>
          <ApiEntry name="data-state" type="'open' | 'closed'">
            Reflects whether this item is open. Always present.
          </ApiEntry>
        </ApiTable>
        <h3 id="content-reference">content()</h3>
        <p>
          Apply to a panel inside ItemContext. Takes no options. Keeps closed panels mounted and
          applies their accessibility attributes immediately, including during visual transitions.
          Use state selectors in <code>css()</code> to hide or animate the panel.
        </p>
        <ApiTable id="content-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="id" type="string">
            Generated panel ID.
          </ApiEntry>
          <ApiEntry name="aria-labelledby" type="string">
            The trigger ID.
          </ApiEntry>
          <ApiEntry name="aria-hidden" type="'true' or absent">
            Present while closed. Hides the panel from screen readers.
          </ApiEntry>
          <ApiEntry name="inert" type="Present or absent">
            Present while closed. Prevents focus and interaction inside the panel.
          </ApiEntry>
          <ApiEntry name="data-state" type="'open' | 'closed'">
            Reflects whether this item is open. Always present.
          </ApiEntry>
        </ApiTable>
        <h3 id="change-listener-reference">onAccordionChange(handler, captureBoolean?)</h3>
        <p>Event mixin for the root or an ancestor.</p>
        <ApiTable id="change-listener-parameters" label="Parameter" defaults>
          <ApiEntry
            name="handler"
            type="(event: Dispatched<AccordionChangeEvent, target>, signal: AbortSignal) => void | Promise<void>"
            required
          >
            Receives the <a href="#change-events-reference">change event</a> with currentTarget
            typed as the listening element. The signal is aborted when the listener is removed.
          </ApiEntry>
          <ApiEntry name="captureBoolean" type="boolean" defaultValue="false">
            Listen in the capture phase when true.
          </ApiEntry>
        </ApiTable>
        <h3 id="change-events-reference">AccordionChangeEvent</h3>
        <p>
          Extends <code>Event</code> with type <code>'rmx:accordion-change'</code>. Bubbles and is
          not cancelable. The following readonly properties are on the event itself.
        </p>
        <ApiTable id="change-events-properties" label="Property">
          <ApiEntry name="accordionType" type="'single' | 'multiple'">
            The accordion's mode at activation.
          </ApiEntry>
          <ApiEntry name="itemValue" type="string">
            The value of the item whose trigger was activated.
          </ApiEntry>
          <ApiEntry name="value" type="string | null | string[]">
            The requested next open value. A string or null in single mode, or an array in multiple
            mode.
          </ApiEntry>
        </ApiTable>
        <p>
          Dispatched after <code>onValueChange</code>. In controlled mode, describes a request even
          if the application declines it. Programmatic value updates and disabled or locked-open
          activation do not dispatch this event. Calling <code>preventDefault()</code> does not veto
          a change.
        </p>
        <p>
          Construct with{' '}
          <code>{'new AccordionChangeEvent(value, { accordionType, itemValue })'}</code>.
          Dispatching an event does not change accordion state.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-AccordionType" name="AccordionType" type="'single' | 'multiple'">
            <p>The accordion mode.</p>
            <CodeBlock html={typeDefinitions.AccordionType} />
          </ApiEntry>
          <ApiEntry id="type-AccordionSingleValue" name="AccordionSingleValue" type="string | null">
            <p>An open item identifier, or null when all panels are closed.</p>
            <CodeBlock html={typeDefinitions.AccordionSingleValue} />
          </ApiEntry>
          <ApiEntry id="type-AccordionMultipleValue" name="AccordionMultipleValue" type="string[]">
            <p>The open item identifiers. An empty array means all panels are closed.</p>
            <CodeBlock html={typeDefinitions.AccordionMultipleValue} />
          </ApiEntry>
          <ApiEntry id="type-AccordionValue" name="AccordionValue" type="string | null | string[]">
            <p>The open value accepted by AccordionChangeEvent.</p>
            <CodeBlock html={typeDefinitions.AccordionValue} />
          </ApiEntry>
          <ApiEntry
            id="type-AccordionBaseContextProps"
            name="AccordionBaseContextProps"
            type="interface"
          >
            <p>Props shared by both Context modes.</p>
            <CodeBlock html={typeDefinitions.AccordionBaseContextProps} />
          </ApiEntry>
          <ApiEntry
            id="type-AccordionSingleContextProps"
            name="AccordionSingleContextProps"
            type="interface"
          >
            <p>
              Context props for single mode. See <a href="#context-reference">Context</a> for field
              types and defaults.
            </p>
            <CodeBlock html={typeDefinitions.AccordionSingleContextProps} />
          </ApiEntry>
          <ApiEntry
            id="type-AccordionMultipleContextProps"
            name="AccordionMultipleContextProps"
            type="interface"
          >
            <p>
              Context props for multiple mode. See <a href="#context-reference">Context</a> for
              field types and defaults.
            </p>
            <CodeBlock html={typeDefinitions.AccordionMultipleContextProps} />
          </ApiEntry>
          <ApiEntry
            id="type-AccordionContextProps"
            name="AccordionContextProps"
            type="AccordionSingleContextProps | AccordionMultipleContextProps"
          >
            <p>The union of both Context prop shapes.</p>
            <CodeBlock html={typeDefinitions.AccordionContextProps} />
          </ApiEntry>
          <ApiEntry id="type-AccordionItemOptions" name="AccordionItemOptions" type="interface">
            <p>
              Item configuration. See <a href="#item-context-reference">ItemContext</a> for field
              types and defaults.
            </p>
            <CodeBlock html={typeDefinitions.AccordionItemOptions} />
          </ApiEntry>
          <ApiEntry
            id="type-AccordionTriggerOptions"
            name="AccordionTriggerOptions"
            type="interface"
          >
            <p>
              Trigger configuration. See <a href="#trigger-reference">trigger()</a> for behavior and
              defaults.
            </p>
            <CodeBlock html={typeDefinitions.AccordionTriggerOptions} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
