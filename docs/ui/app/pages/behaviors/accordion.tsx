import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'

export const meta = {
  title: 'Accordion',
  slug: 'accordion',
  category: 'behaviors',
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
const changeEvents = await loadExample('accordion/events')

const anatomyCode = await highlightSource(`
  import * as accordion from '@remix-run/ui/accordion'

  <accordion.Context>
    <div mix={accordion.root()}>
      <accordion.ItemContext value="shipping">
        <section mix={accordion.item()}>
          <h3>
            <button type="button" mix={accordion.trigger()}>Shipping</button>
          </h3>
          <div mix={accordion.content()}>Delivery preferences</div>
        </section>
      </accordion.ItemContext>
    </div>
  </accordion.Context>
`)

export const preview = basic

export default function AccordionPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>Wrap relevant markup in providers and apply mixins to your own elements.</p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="multiple-state" title="Multiple open panels">
        <p>
          Set <code>type="multiple"</code> to let several panels stay open at once. Opening a panel
          leaves the others open. Select an open panel's trigger again to close it independently.
        </p>
        <Example id="multiple" example={multiple} />
      </Section>
      <Section id="state" title="Controlled state">
        <p>
          Pass <code>value</code> to manage open panels from your application. Accept changes in{' '}
          <code>onValueChange</code> and call <code>handle.update()</code> to render the new value.
          Without <code>value</code>, the accordion manages its own state. <code>defaultValue</code>{' '}
          only sets which panels start open.
        </p>
        <Example
          id="controlled-single"
          example={controlledSingle}
          title="Controlled single value"
          description="A controlled single value identifies the open item. Use null when all panels are closed."
        />
        <Example
          id="controlled-multiple"
          example={controlledMultiple}
          title="Controlled multiple values"
          description="A controlled multiple value contains the open item identifiers. Update the array to open or close panels independently."
        />
      </Section>
      <Section id="collapsing" title="Preventing collapse">
        <p>
          In single mode, <code>{'collapsible={false}'}</code> keeps the selected panel open. Its
          trigger stays focusable. Another enabled trigger can select a different panel.
        </p>
        <Example id="non-collapsible" example={nonCollapsible} />
      </Section>
      <Section id="disabled" title="Disabled state">
        <p>
          Disable the whole accordion with <code>Context disabled</code>, or one item with{' '}
          <code>ItemContext disabled</code>. Disabled items are skipped during keyboard navigation.
          Disabling an item preserves its open state.
        </p>
        <Example
          id="disabled-example"
          example={disabledExample}
          title="Disabling the accordion"
          description="Set disabled on Context to disable every item. Open panels remain open."
        />
        <Example
          id="disabled-item"
          example={disabledItem}
          title="Disabling one item"
          description="Set disabled on ItemContext to disable its trigger and skip it during keyboard navigation. Other items remain interactive."
        />
      </Section>
      <Section id="events" title="Change events">
        <p>
          Use <code>onAccordionChange()</code> on the root or an ancestor to observe changes through
          a bubbling event. Use <code>onValueChange</code> on Context to manage state. In controlled
          mode, both report the requested value.
        </p>
        <Example id="change-events" example={changeEvents} />
      </Section>
      <Section id="accessibility" title="Accessibility and keyboard navigation">
        <p>
          Accordion generates the trigger and panel IDs and connects them with{' '}
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
        <table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default and behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                <code>'single' | 'multiple'</code>
              </td>
              <td>
                Defaults to <code>'single'</code>. Determines whether one or several panels can be
                open.
              </td>
            </tr>
            <tr>
              <td>
                <code>value</code>
              </td>
              <td>
                <code>string | null</code> (single) or <code>string[]</code> (multiple)
              </td>
              <td>
                Omitted for uncontrolled state. Providing a value makes state controlled.{' '}
                <code>null</code> or <code>[]</code> closes all panels.
              </td>
            </tr>
            <tr>
              <td>
                <code>defaultValue</code>
              </td>
              <td>
                <code>string | null</code> (single) or <code>string[]</code> (multiple)
              </td>
              <td>
                Sets the starting state without making it controlled. Defaults to <code>null</code>{' '}
                in single mode or <code>[]</code> in multiple mode. Ignored when value is provided.
                Later changes to defaultValue do not reset state.
              </td>
            </tr>
            <tr>
              <td>
                <code>onValueChange</code>
              </td>
              <td>
                <code>(value: string | null) =&gt; void</code> (single) or{' '}
                <code>(value: string[]) =&gt; void</code> (multiple)
              </td>
              <td>
                Called with the next value requested by a trigger, in either state mode. In
                controlled mode, update your value to accept it.
              </td>
            </tr>
            <tr>
              <td>
                <code>collapsible</code>
              </td>
              <td>
                <code>boolean</code> (single only)
              </td>
              <td>
                Defaults to <code>true</code>. When false, the selected trigger cannot close its
                panel. Does not select an initial panel or prevent your application changing a
                controlled value.
              </td>
            </tr>
            <tr>
              <td>
                <code>disabled</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>
                Defaults to <code>false</code>. Disables all items without changing the open value.
              </td>
            </tr>
            <tr>
              <td>
                <code>children</code>
              </td>
              <td>
                <code>RemixNode</code>
              </td>
              <td>Optional content rendered inside the provider.</td>
            </tr>
          </tbody>
        </table>
        <h3 id="root-reference">root()</h3>
        <p>
          Apply to one container inside Context. Takes no options. Change events bubble from this
          element.
        </p>
        <table>
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Value</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>data-type</code>
              </td>
              <td>
                <code>'single' | 'multiple'</code>
              </td>
              <td>Reflects Context's mode. Always present.</td>
            </tr>
            <tr>
              <td>
                <code>data-disabled</code>
              </td>
              <td>Empty string or absent</td>
              <td>
                Present when Context is disabled. Select with <code>[data-disabled]</code>.
              </td>
            </tr>
          </tbody>
        </table>
        <h3 id="item-context-reference">ItemContext</h3>
        <p>
          Provides state for one item inside Context. Renders its children without adding an
          element.
        </p>
        <table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default and behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>value</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                Required identifier, unique within the accordion. Used in open values and change
                events.
              </td>
            </tr>
            <tr>
              <td>
                <code>disabled</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>
                Defaults to <code>false</code>. Disables this item and excludes it from arrow-key
                navigation. An item also inherits a disabled Context. Its open state is preserved.
              </td>
            </tr>
            <tr>
              <td>
                <code>children</code>
              </td>
              <td>
                <code>RemixNode</code>
              </td>
              <td>Optional content rendered inside the provider.</td>
            </tr>
          </tbody>
        </table>
        <h4 id="item-state-reference">Provided state</h4>
        <p>
          Read <code>handle.context.get(accordion.ItemContext)</code> inside the provider. Its
          readonly properties reflect the current item state. Read them during render.
        </p>
        <table>
          <thead>
            <tr>
              <th>Property</th>
              <th>Type</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>value</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>The item's identifier.</td>
            </tr>
            <tr>
              <td>
                <code>open</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>Whether the accordion's open value includes this item.</td>
            </tr>
            <tr>
              <td>
                <code>disabled</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>
                Whether Context or ItemContext disables this item. Trigger-only disabling does not
                change it.
              </td>
            </tr>
            <tr>
              <td>
                <code>lockedOpen</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>Whether this item is open in single mode with collapsible false.</td>
            </tr>
            <tr>
              <td>
                <code>triggerId</code>, <code>panelId</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Generated IDs used by the trigger and content mixins to connect the elements.</td>
            </tr>
          </tbody>
        </table>
        <h3 id="item-reference">item()</h3>
        <p>
          Apply to a wrapper inside ItemContext. Takes no options. Decorates it with state
          attributes for selectors in <code>css()</code>.
        </p>
        <table>
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Value</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>data-state</code>
              </td>
              <td>
                <code>'open' | 'closed'</code>
              </td>
              <td>Reflects whether this item is open. Always present.</td>
            </tr>
            <tr>
              <td>
                <code>data-disabled</code>
              </td>
              <td>Empty string or absent</td>
              <td>
                Present when Context or ItemContext disables this item. Select with{' '}
                <code>[data-disabled]</code>.
              </td>
            </tr>
          </tbody>
        </table>
        <h3 id="trigger-reference">trigger(options?)</h3>
        <p>
          Apply to a native button inside ItemContext. Handles activation and{' '}
          <a href="#accessibility">keyboard navigation</a>, and connects the button to its panel.
        </p>
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>Type</th>
              <th>Default</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>disabled</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>
                <code>false</code>
              </td>
              <td>
                Prevents activation. A native disabled prop on the button has the same effect.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          A disabled item also disables its trigger. Trigger-only disabling prevents activation but
          does not exclude the item from arrow-key navigation. Use ItemContext disabled when the
          item should be skipped.
        </p>
        <h4>Element attributes</h4>
        <table>
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Value</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>id</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Generated trigger ID.</td>
            </tr>
            <tr>
              <td>
                <code>aria-controls</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>The panel ID.</td>
            </tr>
            <tr>
              <td>
                <code>aria-expanded</code>
              </td>
              <td>
                <code>'true' | 'false'</code>
              </td>
              <td>Reflects whether the panel is open.</td>
            </tr>
            <tr>
              <td>
                <code>aria-disabled</code>
              </td>
              <td>
                <code>'true'</code> or absent
              </td>
              <td>
                Present when the selected panel is locked open. The trigger remains focusable.
              </td>
            </tr>
            <tr>
              <td>
                <code>disabled</code>
              </td>
              <td>Present or absent</td>
              <td>
                Present when the item, trigger option or native button prop disables the trigger.
              </td>
            </tr>
            <tr>
              <td>
                <code>data-state</code>
              </td>
              <td>
                <code>'open' | 'closed'</code>
              </td>
              <td>Reflects whether this item is open. Always present.</td>
            </tr>
          </tbody>
        </table>
        <h3 id="content-reference">content()</h3>
        <p>
          Apply to a panel inside ItemContext. Takes no options. Keeps closed panels mounted and
          applies their accessibility attributes immediately, including during visual transitions.
          Use state selectors in <code>css()</code> to hide or animate the panel.
        </p>
        <table>
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Value</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>id</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Generated panel ID.</td>
            </tr>
            <tr>
              <td>
                <code>aria-labelledby</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>The trigger ID.</td>
            </tr>
            <tr>
              <td>
                <code>aria-hidden</code>
              </td>
              <td>
                <code>'true'</code> or absent
              </td>
              <td>Present while closed. Hides the panel from screen readers.</td>
            </tr>
            <tr>
              <td>
                <code>inert</code>
              </td>
              <td>Present or absent</td>
              <td>Present while closed. Prevents focus and interaction inside the panel.</td>
            </tr>
            <tr>
              <td>
                <code>data-state</code>
              </td>
              <td>
                <code>'open' | 'closed'</code>
              </td>
              <td>Reflects whether this item is open. Always present.</td>
            </tr>
          </tbody>
        </table>
        <h3 id="change-listener-reference">onAccordionChange(handler, captureBoolean?)</h3>
        <p>
          Event mixin for the root or an ancestor. The handler receives an{' '}
          <code>AccordionChangeEvent</code> and an <code>AbortSignal</code>, and returns{' '}
          <code>void | Promise&lt;void&gt;</code>. The capture flag defaults to false. Pass true to
          listen in the capture phase.
        </p>
        <h3 id="change-events-reference">AccordionChangeEvent</h3>
        <p>
          Extends <code>Event</code> with type <code>'rmx:accordion-change'</code>. Bubbles and is
          not cancelable. The following readonly properties are on the event itself.
        </p>
        <table>
          <thead>
            <tr>
              <th>Property</th>
              <th>Type</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>accordionType</code>
              </td>
              <td>
                <code>'single' | 'multiple'</code>
              </td>
              <td>The accordion's mode at activation.</td>
            </tr>
            <tr>
              <td>
                <code>itemValue</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>The value of the item whose trigger was activated.</td>
            </tr>
            <tr>
              <td>
                <code>value</code>
              </td>
              <td>
                <code>string | null | string[]</code>
              </td>
              <td>
                The requested next open value. A string or null in single mode, or an array in
                multiple mode.
              </td>
            </tr>
          </tbody>
        </table>
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
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Definition</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>AccordionType</code>
              </td>
              <td>
                <code>'single' | 'multiple'</code>
              </td>
              <td>The accordion mode.</td>
            </tr>
            <tr>
              <td>
                <code>AccordionSingleValue</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>An open item identifier, or null when all panels are closed.</td>
            </tr>
            <tr>
              <td>
                <code>AccordionMultipleValue</code>
              </td>
              <td>
                <code>string[]</code>
              </td>
              <td>The open item identifiers. An empty array means all panels are closed.</td>
            </tr>
            <tr>
              <td>
                <code>AccordionValue</code>
              </td>
              <td>
                <code>AccordionSingleValue | AccordionMultipleValue</code>
              </td>
              <td>The open value accepted by AccordionChangeEvent.</td>
            </tr>
            <tr>
              <td>
                <code>AccordionBaseContextProps</code>
              </td>
              <td>
                <code>children?</code>, <code>disabled?</code>
              </td>
              <td>Props shared by both Context modes.</td>
            </tr>
            <tr>
              <td>
                <code>AccordionSingleContextProps</code>
              </td>
              <td>
                Base props with single-mode state and <code>collapsible?</code>
              </td>
              <td>
                Context props for single mode. See <a href="#context-reference">Context</a> for
                field types and defaults.
              </td>
            </tr>
            <tr>
              <td>
                <code>AccordionMultipleContextProps</code>
              </td>
              <td>
                Base props with <code>type="multiple"</code> and array state
              </td>
              <td>
                Context props for multiple mode. See <a href="#context-reference">Context</a> for
                field types and defaults.
              </td>
            </tr>
            <tr>
              <td>
                <code>AccordionContextProps</code>
              </td>
              <td>
                <code>AccordionSingleContextProps | AccordionMultipleContextProps</code>
              </td>
              <td>The union of both Context prop shapes.</td>
            </tr>
            <tr>
              <td>
                <code>AccordionItemOptions</code>
              </td>
              <td>
                <code>value</code>, <code>disabled?</code>
              </td>
              <td>
                Item configuration. See <a href="#item-context-reference">ItemContext</a> for field
                types and defaults.
              </td>
            </tr>
            <tr>
              <td>
                <code>AccordionTriggerOptions</code>
              </td>
              <td>
                <code>disabled?</code>
              </td>
              <td>
                Trigger configuration. See <a href="#trigger-reference">trigger()</a> for behavior
                and defaults.
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    </PageLayout>
  )
}
