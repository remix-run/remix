import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Select',
  slug: 'select',
  category: 'patterns',
  description: 'Choose a single value from a button-triggered option list.',
  importPath: '@remix-run/ui/select',
} satisfies PageMeta

const basic = await loadExample('select/basic')
const richOptionsExample = await loadExample('select/rich-options')
const disabledExample = await loadExample('select/disabled')
const formExample = await loadExample('select/form')

const anatomyCode = await highlightSource(`
  import * as select from '@remix-run/ui/select'
  import * as popover from '@remix-run/ui/popover'

  <select.Context defaultLabel="Choose delivery">
    <button type="button" mix={select.trigger()}><SelectedLabel /></button>
    <popover.Context>
      <div mix={select.popover()}>
        <div aria-label="Delivery methods" mix={select.list()}>
          <div mix={select.option({ label: 'Standard', value: 'standard' })}>Standard</div>
          <div mix={select.option({ label: 'Express', value: 'express' })}>Express</div>
        </div>
      </div>
    </popover.Context>
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
  <button aria-label="Delivery method" type="button" mix={select.trigger()}>
    <SelectedLabel />
  </button>
  <div aria-label="Delivery methods" mix={select.list()} />
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
      <Example id="basic" example={basic} hero compact />
      <Section id="anatomy" title="Anatomy">
        <p>
          Keep the trigger, popover, list and options inside the select provider. The surface also
          needs a Popover provider.
        </p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="initial" title="Initial selection">
        <p>
          <code>defaultValue</code> sets the initial selected option. <code>defaultLabel</code> sets
          the initial trigger text independently. Read <code>displayedLabel</code> from{' '}
          <code>Context</code> to follow committed labels. Select currently has no controlled{' '}
          <code>value</code> prop or value-change callback.
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
        <Example id="rich-options-example" example={richOptionsExample} compact />
      </Section>
      <Section id="forms" title="Forms">
        <p>
          Give <code>Context</code> a <code>name</code> and apply <code>hiddenInput()</code> to an
          input. It submits the selected value, with an empty string when no value is selected.
          Disabled selects are omitted from <code>FormData</code>.
        </p>
        <Example id="form-example" example={formExample} compact />
      </Section>
      <Section id="events" title="Change events">
        <p>
          <code>onSelectChange()</code> listens on the trigger or an ancestor. It receives the
          committed <code>value</code>, <code>label</code> and <code>optionId</code> after the popup
          closes and its label settles. Selecting the same value again does not dispatch a change.
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
          <code>labelSwapDelayMs</code> adds a delay after closure, defaulting to 75 ms. The
          displayed label then changes and the change event fires. Selecting through typeahead on a
          closed trigger skips this sequence.
        </p>
      </Section>
      <Section id="disabled" title="Disabled state">
        <p>
          <code>disabled</code> on <code>Context</code> disables the trigger and hidden input.{' '}
          <code>disabled</code> on an option skips it during navigation, typeahead and selection.
        </p>
        <Example id="disabled-example" example={disabledExample} compact />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Give the trigger and list accessible names. Focus moves to the list while{' '}
          <code>aria-activedescendant</code> identifies the highlighted option.
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
        <ApiTable
          id="context-options"
          label="Option"
          defaults
          entries={[
            {
              name: 'defaultLabel',
              type: <code>{'string'}</code>,
              description: 'Initial trigger text and fallback label.',
              required: true,
            },
            {
              name: 'defaultValue',
              type: <code>{'string | null'}</code>,
              description: 'Initial selected value.',
              defaultValue: <code>{'null'}</code>,
            },
            {
              name: 'disabled',
              type: <code>{'boolean'}</code>,
              description: 'Disables trigger and hidden input.',
              defaultValue: <code>{'false'}</code>,
            },
            {
              name: 'name',
              type: <code>{'string'}</code>,
              description: 'Form field name used by hiddenInput().',
            },
            {
              name: 'labelSwapDelayMs',
              type: <code>{'number'}</code>,
              description: 'Additional label delay in milliseconds.',
              defaultValue: <code>{'75'}</code>,
            },
            {
              name: 'children',
              type: <code>{'RemixNode'}</code>,
              description: 'Trigger, popup and optional hidden input.',
            },
          ]}
        />
        <p>
          Descendants can read <code>displayedLabel</code>, <code>value</code>, <code>isOpen</code>,{' '}
          <code>isExpanded</code>, <code>disabled</code>, <code>name</code>, <code>listId</code>,{' '}
          <code>activeId</code> and <code>selectedId</code> from the provider context.{' '}
          <code>open()</code> and <code>close()</code> request popup changes. There is no exported
          context-value type.
        </p>
        <h3 id="trigger-reference">trigger()</h3>
        <ApiTable
          id="trigger-attributes"
          label="Attribute"
          typeLabel="Value"
          entries={[
            {
              name: 'aria-haspopup',
              type: <code>{'listbox'}</code>,
              description: 'Popup semantics.',
            },
            {
              name: 'aria-expanded',
              type: <code>{'true | false'}</code>,
              description: 'Popup expansion state.',
            },
            {
              name: 'aria-controls',
              type: <code>{'string'}</code>,
              description: 'Generated list ID.',
            },
            {
              name: 'aria-describedby',
              type: <code>{'string | absent'}</code>,
              description: 'Selected option ID.',
            },
            {
              name: 'disabled',
              type: <code>{'true | absent'}</code>,
              description: 'Reflects Context disabled state or host disabled.',
            },
          ]}
        />
        <h3 id="popover-reference">popover()</h3>
        <p>
          Requires <code>popover.Context</code> from the Popover module. Positions the selected
          option over the trigger using inset relative alignment. The surface’s minimum width
          follows the trigger. Adds <code>popover=&quot;manual&quot;</code> through the Popover
          surface mixin.
        </p>
        <h3 id="list-reference">list()</h3>
        <ApiTable
          id="list-attributes"
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'role', type: <code>{'listbox'}</code>, description: 'Supplied by Listbox.' },
            { name: 'id', type: <code>{'string'}</code>, description: 'Generated list ID.' },
            {
              name: 'tabIndex',
              type: <code>{'-1'}</code>,
              description: 'Programmatic focus target.',
            },
            {
              name: 'aria-activedescendant',
              type: <code>{'string | absent'}</code>,
              description: 'Highlighted option ID.',
            },
          ]}
        />
        <h3 id="option-reference">option(options)</h3>
        <p>
          Uses the Listbox option contract. <code>label</code> and <code>value</code> are required.{' '}
          <code>disabled</code> and <code>textValue</code> are optional.
        </p>
        <ApiTable
          id="option-attributes"
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'role', type: <code>{'option'}</code>, description: 'Option semantics.' },
            { name: 'id', type: <code>{'string'}</code>, description: 'Generated option ID.' },
            {
              name: 'aria-selected, aria-disabled',
              type: <code>{'true | false'}</code>,
              description: 'Selected and disabled state.',
            },
            {
              name: 'data-highlighted',
              type: <code>{'true | false'}</code>,
              description: 'Highlighted state.',
            },
            {
              name: 'data-select-flash',
              type: <code>{'true | absent'}</code>,
              description: 'Temporary selection feedback.',
            },
          ]}
        />
        <h3 id="hidden-input-reference">hiddenInput()</h3>
        <ApiTable
          id="hidden-input-attributes"
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'type', type: <code>{'hidden'}</code>, description: 'Native hidden input.' },
            { name: 'name', type: <code>{'string | absent'}</code>, description: 'Context name.' },
            {
              name: 'value',
              type: <code>{'string'}</code>,
              description: 'Selected value or empty string.',
            },
            {
              name: 'disabled',
              type: <code>{'true | absent'}</code>,
              description: 'Context disabled state.',
            },
          ]}
        />
        <h3 id="change-listener-reference">onSelectChange(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:select-change</code>. Receives the event and an abort signal.
          Capture defaults to false. Events bubble from the trigger, or from the surface when no
          trigger is registered.
        </p>
        <h3 id="change-event-reference">SelectChangeEvent</h3>
        <ApiTable
          id="change-event-properties"
          label="Property"
          entries={[
            {
              name: 'value',
              type: <code>{'string | null'}</code>,
              description: 'Committed option value.',
            },
            {
              name: 'label',
              type: <code>{'string | null'}</code>,
              description: 'Committed option label.',
            },
            {
              name: 'optionId',
              type: <code>{'string | null'}</code>,
              description: 'Generated option ID.',
            },
          ]}
        />
        <h3 id="types-reference">Exported types</h3>
        <ApiTable
          id="types-types"
          detailsLabel="Definition"
          entries={[
            {
              name: 'SelectContextProps',
              type: <code>{'interface'}</code>,
              description: 'Initial selection, label, timing, disabled state and form name.',
              id: 'type-SelectContextProps',
              details: <CodeBlock html={typeDefinitions.SelectContextProps} />,
            },
          ]}
        />
        <p>Option types belong to the Listbox module. Positioning types belong to Anchor.</p>
      </Section>
    </PageLayout>
  )
}
