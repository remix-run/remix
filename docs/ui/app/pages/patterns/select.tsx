import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Select',
  slug: 'select',
  category: 'patterns',
  description: 'Choose a single value from a button-triggered option list.',
  importPath: '@remix-run/ui/select',
} satisfies PageMeta

const basic = await loadExample('select/basic')
const richOptionsExample = await loadExample('select/rich-options')
const groupedExample = await loadExample('select/grouped')
const disabledExample = await loadExample('select/disabled')
const formExample = await loadExample('select/form')

const anatomyCode = await highlightSource(`
  import * as select from '@remix-run/ui/select'
  import * as popover from '@remix-run/ui/popover'
  import { css } from 'remix/component'
  import type { Handle } from 'remix/component'

  <select.Context name="field-name" defaultLabel="Trigger text">
    <span id="select-label">Select label</span>
    <button
      type="button"
      aria-labelledby="select-label"
      mix={[
        select.trigger(),
        css({
          '&[aria-expanded="true"]': {},
          '&[aria-expanded="false"]': {},
          '&:focus-visible': {},
          '&:disabled': {},
        }),
      ]}
    >
      <SelectedLabel />
    </button>
    <popover.Context>
      <div
        mix={[
          select.popover(),
          css({
            '&:popover-open': {},
          }),
        ]}
      >
        <div aria-label="Options" mix={select.list()}>
          <div
            mix={[
              select.option({
                label: 'Option text',
                value: 'option-value',
              }),
              css({
                '&[data-highlighted="true"]': {},
                '&[data-highlighted="false"]': {},
                '&[aria-selected="true"]': {},
                '&[aria-selected="false"]': {},
                '&[aria-disabled="true"]': {},
                '&[aria-disabled="false"]': {},
                '&[data-select-flash]': {},
              }),
            ]}
          >
            Option text
          </div>
        </div>
      </div>
    </popover.Context>
    <input mix={select.hiddenInput()} />
  </select.Context>

  function SelectedLabel(handle: Handle) {
    let context = handle.context.get(select.Context)
    return () => <span>{context.displayedLabel}</span>
  }
`)

const initialCode = await highlightSource(`
  <select.Context defaultValue="standard" defaultLabel="Standard delivery">
    {/* Trigger and options */}
  </select.Context>
`)

const eventsCode = await highlightSource(`
  <div mix={select.onSelectChange((event) => {
    saveSelection(event.value, event.label)
  })}>
    {/* Select */}
  </div>
`)

const accessibilityCode = await highlightSource(`
  <>
    <span id="delivery-method-label">Delivery method</span>
    <button aria-labelledby="delivery-method-label" type="button" mix={select.trigger()}>
      <SelectedLabel />
    </button>
    <div aria-label="Delivery methods" mix={select.list()} />
  </>
`)

const typeDefinitions = {
  SelectContextProps: await highlightSource(
    `export interface SelectContextProps {
  children?: RemixNode
  defaultLabel: string
  defaultValue?: string | null
  disabled?: boolean
  labelSwapDelayMs?: number
  name?: string
}`,
  ),
}

export default function SelectPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="initial" title="Initial selection">
        <p>
          <code>defaultValue</code> sets the initial selected option. <code>defaultLabel</code> sets
          the initial trigger text independently. Read <code>displayedLabel</code> from{' '}
          <code>Context</code> to follow committed labels. Select manages selection internally.
          Later changes to <code>defaultValue</code> do not reset selection.
        </p>
        <CodeBlock html={initialCode} />
      </Section>
      <Section id="options" title="Option content and typeahead">
        <p>
          The option’s <code>label</code> becomes the trigger text after selection. Its children can
          show richer content. <code>textValue</code> supplies a string or aliases for typeahead.
          Typeahead works in the popup and on the closed trigger. Closed-trigger matches select
          immediately.
        </p>
        <p>
          Keep option content noninteractive. Text, descriptions and decorative icons belong inside
          an option. Buttons, links and inputs need their own controls outside the list.
        </p>
        <Example id="rich-options-example" example={richOptionsExample} />
      </Section>
      <Section id="grouped" title="Grouped options">
        <p>
          Wrap related options in an element with <code>role="group"</code> and name it with{' '}
          <code>aria-labelledby</code> pointing to a visible group label. Keep group labels outside
          the selectable options. Navigation and typeahead continue across group boundaries.
        </p>
        <Example id="grouped-example" example={groupedExample} />
      </Section>
      <Section id="forms" title="Forms">
        <p>
          Give <code>Context</code> a <code>name</code> and apply <code>hiddenInput()</code> to an
          input. It submits the selected value, with an empty string when no value is selected.
          Disabled selects are omitted from <code>FormData</code>.
        </p>
        <Example id="form-example" example={formExample} />
      </Section>
      <Section id="events" title="Change events">
        <p>
          <code>onSelectChange()</code> listens on the trigger or an ancestor. It receives the
          committed <code>value</code>, <code>label</code> and <code>optionId</code> after the popup
          closes and its label settles. Closed-trigger typeahead dispatches after selection updates,
          without the closing sequence. Selecting the same value again does not dispatch a change.
        </p>
        <CodeBlock html={eventsCode} />
      </Section>
      <Section id="feedback" title="Selection and close feedback">
        <p>
          <code>data-select-flash</code> marks a fixed 60 ms selection flash. Style it separately
          from the surface’s closing transition.
        </p>
        <p>
          The trigger keeps its previous label through the flash and close transition.{' '}
          <code>labelSwapDelayMs</code> adds a delay after the surface’s close transition,
          defaulting to 75 ms. Set it to zero to update the label as soon as that transition
          finishes. The displayed label then changes and the change event fires. Selecting through
          typeahead on a closed trigger skips this sequence.
        </p>
      </Section>
      <Section id="disabled" title="Disabled state">
        <p>
          <code>disabled</code> on <code>Context</code> disables the trigger and hidden input.{' '}
          <code>disabled</code> on an option skips it during navigation, typeahead and selection.
        </p>
        <Example id="disabled-example" example={disabledExample} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Give the field a visible label and connect it to the trigger with{' '}
          <code>aria-labelledby</code>. Give the list an accessible name too. Focus moves to the
          list while <code>aria-activedescendant</code> identifies the highlighted option.
        </p>
        <CodeBlock html={accessibilityCode} />
        <ul>
          <li>Click, ArrowDown and ArrowUp open the popup.</li>
          <li>Enter and Space select the highlighted option.</li>
          <li>Escape and outside clicks close the popup and return focus to the trigger.</li>
        </ul>
        <p>
          List navigation follows <a href="/patterns/listbox/#accessibility">Listbox</a>, including
          its current Tab interception.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <ApiTable id="context-options" label="Option" defaults>
          <ApiEntry name="defaultLabel" type="string" required>
            Initial trigger text and fallback label.
          </ApiEntry>
          <ApiEntry name="defaultValue" type="string | null" defaultValue="null">
            Initial selected value.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Disables trigger and hidden input.
          </ApiEntry>
          <ApiEntry name="name" type="string">
            Form field name used by hiddenInput().
          </ApiEntry>
          <ApiEntry name="labelSwapDelayMs" type="number" defaultValue="75">
            Additional label delay in milliseconds.
          </ApiEntry>
          <ApiEntry name="children" type="RemixNode">
            Trigger, popup and optional hidden input.
          </ApiEntry>
        </ApiTable>
        <p>
          Read these members with <code>handle.context.get(select.Context)</code> in a descendant.
        </p>
        <ApiTable id="context-state" label="Provided member">
          <ApiEntry name="value" type="string | null">
            Selected value. Updates at the start of selection feedback, before the displayed label
            and change event.
          </ApiEntry>
          <ApiEntry name="displayedLabel" type="string">
            Trigger text. Retains the previous label until the close transition and label delay
            finish.
          </ApiEntry>
          <ApiEntry name="isOpen" type="boolean">
            Whether the surface is logically open. False during its close transition.
          </ApiEntry>
          <ApiEntry name="isExpanded" type="boolean">
            True while open or selection is settling, including the close transition and label
            delay. Drives the trigger’s aria-expanded.
          </ApiEntry>
          <ApiEntry name="activeId" type="string | undefined">
            Highlighted option ID.
          </ApiEntry>
          <ApiEntry name="selectedId" type="string | undefined">
            Selected option ID, resolved after mounting for an initial value.
          </ApiEntry>
          <ApiEntry name="listId" type="string">
            Generated list ID.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean">
            Provider disabled state.
          </ApiEntry>
          <ApiEntry name="name" type="string | undefined">
            Form field name.
          </ApiEntry>
          <ApiEntry name="open" type="() => void">
            Opens from the selected value. Ignored when disabled, already open or selection is
            settling.
          </ApiEntry>
          <ApiEntry name="close" type="() => void">
            Closes an open surface without changing selection. Ignored while selection is settling.
          </ApiEntry>
        </ApiTable>
        <h3 id="trigger-reference">trigger()</h3>
        <ApiTable id="trigger-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="aria-haspopup" type="listbox">
            Popup semantics.
          </ApiEntry>
          <ApiEntry name="aria-expanded" type="true | false">
            Popup expansion state.
          </ApiEntry>
          <ApiEntry name="aria-controls" type="string">
            Generated list ID.
          </ApiEntry>
          <ApiEntry name="aria-describedby" type="string | absent">
            Selected option ID.
          </ApiEntry>
          <ApiEntry name="disabled" type="true | absent">
            Reflects Context disabled state or host disabled.
          </ApiEntry>
        </ApiTable>
        <h3 id="popover-reference">popover()</h3>
        <p>
          Requires <code>popover.Context</code> from the Popover module. Positions the selected
          option over the trigger using inset relative alignment. The surface’s minimum width
          follows the trigger. Adds <code>popover=&quot;manual&quot;</code> through the Popover
          surface mixin.
        </p>
        <h3 id="list-reference">list()</h3>
        <ApiTable id="list-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="listbox">
            Supplied by Listbox.
          </ApiEntry>
          <ApiEntry name="id" type="string">
            Generated list ID.
          </ApiEntry>
          <ApiEntry name="tabIndex" type="-1">
            Programmatic focus target.
          </ApiEntry>
          <ApiEntry name="aria-activedescendant" type="string | absent">
            Highlighted option ID.
          </ApiEntry>
        </ApiTable>
        <h3 id="option-reference">option(options)</h3>
        <p>
          Uses the Listbox option contract. <code>label</code> and <code>value</code> are required.{' '}
          <code>disabled</code> and <code>textValue</code> are optional. Typeahead uses{' '}
          case-insensitive prefix matching against <code>textValue</code> instead of the label when
          supplied. See the{' '}
          <a href="/patterns/listbox/#option-reference">Listbox option reference</a>. Options with
          the native <code>hidden</code> attribute are skipped.
        </p>
        <ApiTable id="option-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="option">
            Option semantics.
          </ApiEntry>
          <ApiEntry name="id" type="string">
            Generated option ID.
          </ApiEntry>
          <ApiEntry name="aria-selected, aria-disabled" type="true | false">
            Selected and disabled state.
          </ApiEntry>
          <ApiEntry name="data-highlighted" type="true | false">
            Highlighted state.
          </ApiEntry>
          <ApiEntry name="data-select-flash" type="true | absent">
            Temporary selection feedback.
          </ApiEntry>
        </ApiTable>
        <h3 id="hidden-input-reference">hiddenInput()</h3>
        <ApiTable id="hidden-input-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="type" type="hidden">
            Native hidden input.
          </ApiEntry>
          <ApiEntry name="name" type="string | absent">
            Context name.
          </ApiEntry>
          <ApiEntry name="value" type="string">
            Selected value or empty string.
          </ApiEntry>
          <ApiEntry name="disabled" type="true | absent">
            Context disabled state.
          </ApiEntry>
        </ApiTable>
        <h3 id="change-listener-reference">onSelectChange(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:select-change</code>. Receives the event and an abort signal.
          Capture defaults to false. Events bubble from the trigger, or from the surface when no
          trigger is registered. They are not cancelable.
        </p>
        <h3 id="change-event-reference">SelectChangeEvent</h3>
        <ApiTable id="change-event-properties" label="Property">
          <ApiEntry name="value" type="string | null">
            Committed option value.
          </ApiEntry>
          <ApiEntry name="label" type="string | null">
            Committed option label.
          </ApiEntry>
          <ApiEntry name="optionId" type="string | null">
            Generated option ID.
          </ApiEntry>
        </ApiTable>
        <p>
          Construct with <code>{'new SelectChangeEvent({ value, label, optionId })'}</code>.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-SelectContextProps" name="SelectContextProps" type="interface">
            <p>Initial selection, label, timing, disabled state and form name.</p>
            <CodeBlock html={typeDefinitions.SelectContextProps} />
          </ApiEntry>
        </ApiTable>
        <p>Option types belong to the Listbox module. Positioning types belong to Anchor.</p>
      </Section>
    </PageLayout>
  )
}
