import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Combobox',
  slug: 'combobox',
  category: 'patterns',
  description: 'Filter options with editable text and commit a single value.',
  importPath: '@remix-run/ui/combobox',
} satisfies PageMeta

const basic = await loadExample('combobox/basic')
const initialExample = await loadExample('combobox/initial')
const richOptionsExample = await loadExample('combobox/rich-options')
const disabledExample = await loadExample('combobox/disabled')
const formExample = await loadExample('combobox/form')
const imperativeExample = await loadExample('combobox/imperative')

const anatomyCode = await highlightSource(`
  import * as combobox from '@remix-run/ui/combobox'

  <combobox.Context name="state">
    <label for="state">State</label>
    <input id="state" mix={combobox.input()} />
    <div mix={combobox.popover()}>
      <div aria-label="US states" mix={combobox.list()}>
        <div mix={combobox.option({ label: 'California', value: 'CA' })}>California</div>
        <div mix={combobox.option({ label: 'New York', value: 'NY' })}>New York</div>
      </div>
    </div>
    <input mix={combobox.hiddenInput()} />
  </combobox.Context>
`)

const eventsCode = await highlightSource(`
  <div mix={combobox.onComboboxChange((event) => {
    saveSelection(event.value, event.label)
  })}>
    {/* Combobox */}
  </div>
`)

const accessibilityCode = await highlightSource(`
  <label for="state">State</label>
  <input id="state" mix={combobox.input()} />
  <div aria-label="US states" mix={combobox.list()} />
`)

const typeDefinitions = {
  ComboboxContextProps: await highlightSource(
    `export interface ComboboxContextProps {
  children?: RemixNode
  defaultValue?: string | null
  disabled?: boolean
  name?: string
  ref?: (handle: ComboboxHandle) => void
}`,
  ),
  ComboboxOptionOptions: await highlightSource(
    `export interface ComboboxOptionOptions {
  disabled?: boolean
  label: string
  searchValue?: string | string[]
  value: string
}`,
  ),
  ComboboxOpenStrategy: await highlightSource(
    `export type ComboboxOpenStrategy = 'selected' | 'selected-or-none' | 'first' | 'last'`,
  ),
  ComboboxHandle: await highlightSource(
    `export interface ComboboxHandle {
  readonly activeOptionId: string | null
  readonly id: string
  readonly inputText: string
  readonly isOpen: boolean
  readonly label: string | null
  readonly value: string | null
  close: () => void
  open: (strategy?: ComboboxOpenStrategy) => Promise<void>
}`,
  ),
}

export default function ComboboxPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>
          Wrap the input, popover and options in one provider. Combobox supplies its Popover and
          Listbox providers.
        </p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="initial" title="Selection">
        <p>
          Combobox tracks the input text separately from the selected option’s value. The input text
          can contain an unfinished search. The selected value always identifies an accepted option.
          Editing clears the selected value, and choosing an option sets it again.
        </p>
        <p>
          Combobox manages selection and input text internally. <code>defaultValue</code> sets the
          initial committed value and input text to a registered option’s value string. Selecting an
          option later replaces the text with its label.
        </p>

        <p>
          On blur, an exact enabled label or alias match commits the option and preserves the typed
          text. Partial or unmatched text is cleared.
        </p>
        <Example id="initial-example" example={initialExample} />
      </Section>
      <Section id="options" title="Filtering and aliases">
        <p>
          Typing filters options by case-insensitive prefix matching. <code>searchValue</code>{' '}
          supplies a string or aliases in place of the label. Non-matching options receive{' '}
          <code>hidden</code>. Include the full label in custom search values so a selection still
          matches when the input loses focus. Disabled options can remain visible but cannot be
          selected.
        </p>
        <p>
          An empty search or a search with no matches closes the popup. Unmatched text stays in the
          input while editing. Clicking the closed input or pressing an arrow key reopens the full
          list when the text is an exact match or has no matches.
        </p>
        <Example id="rich-options-example" example={richOptionsExample} />
      </Section>
      <Section id="forms" title="Forms">
        <p>
          The visible input contains the search text. A second input with <code>hiddenInput()</code>{' '}
          submits the selected value under the provider’s <code>name</code>.
        </p>
        <p>
          Choosing California displays "California" and submits <code>state=CA</code>. While typing,
          the submitted value is empty until a selection is committed. Disabled controls are omitted
          from <code>FormData</code>.
        </p>

        <Example id="form-example" example={formExample} />
      </Section>
      <Section id="events" title="Change events">
        <p>
          <code>onComboboxChange()</code> receives committed-value changes from the input or an
          ancestor. Its <code>value</code>, <code>label</code> and <code>optionId</code> become null
          when editing clears a selection. Recommitting an unchanged value does not dispatch another
          change. Blur matching commits immediately, without the selection flash.
        </p>
        <CodeBlock html={eventsCode} />
      </Section>
      <Section id="imperative" title="Imperative access">
        <p>
          The provider's <code>ref</code> receives a <code>ComboboxHandle</code>.{' '}
          <code>open()</code> can start at the selected option, an enabled boundary or no option.{' '}
          <code>close()</code> dismisses the popup.
        </p>
        <Example id="imperative-example" example={imperativeExample} />
      </Section>
      <Section id="feedback" title="Popup and selection feedback">
        <p>
          <code>data-combobox-flash</code> marks a fixed 60 ms selection flash. The committed-value
          change event fires after the flash, before closing starts.
        </p>
        <p>
          Typing opens a hint with <code>data-show-reason="hint"</code>. Dismissing that hint skips
          the close transition. Highlighting or selecting an option switches to{' '}
          <code>data-show-reason="nav"</code>. Navigation closures keep{' '}
          <code>data-surface-visible</code> on the input through the transition. The chosen label
          appears 50 ms later. This delay is fixed.
        </p>
      </Section>
      <Section id="disabled" title="Disabled state">
        <p>
          <code>disabled</code> on <code>Context</code> disables the input and hidden input.
          Disabled options are skipped during highlighting and selection.
        </p>
        <Example id="disabled-example" example={disabledExample} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Focus stays on the text input during arrow navigation and pointer selection. Give the
          input a visible label and the list an accessible name.
        </p>
        <CodeBlock html={accessibilityCode} />
        <ul>
          <li>
            ArrowDown and ArrowUp open results or move the highlight using Listbox’s navigation
            rules.
          </li>
          <li>
            Typing opens matching results. Use an arrow key to highlight an option, then Enter to
            select it.
          </li>
          <li>Escape dismisses the popup.</li>
          <li>Tab moves focus away and triggers blur matching.</li>
        </ul>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <ApiTable
          id="context-options"
          label="Option"
          defaults
          entries={[
            {
              name: 'defaultValue',
              type: <code>{'string | null'}</code>,
              description: 'Initial committed value and initial draft text.',
              defaultValue: <code>{'null'}</code>,
            },
            {
              name: 'disabled',
              type: <code>{'boolean'}</code>,
              description: 'Disables input and hidden input.',
              defaultValue: <code>{'false'}</code>,
            },
            {
              name: 'name',
              type: <code>{'string'}</code>,
              description: 'Form field name for the committed value.',
            },
            {
              name: 'ref',
              type: <code>{'(handle: ComboboxHandle) => void'}</code>,
              description: 'Receives a live imperative handle once after mounting.',
            },
            {
              name: 'children',
              type: <code>{'RemixNode'}</code>,
              description: 'Input, surface, list, options and hidden input.',
            },
          ]}
        />
        <h3 id="input-reference">input()</h3>
        <p>
          On blur, an exact match against an enabled option’s search values selects that option.
          Search values default to the label and can be replaced with <code>searchValue</code>.
          Matching ignores case and preserves the typed text, including aliases. Partial or
          unmatched text and selection are cleared.
        </p>
        <p>
          Escape closes the list and clears unmatched text and selection. Exact matches remain in
          the input, but Escape alone does not select them.
        </p>
        <ApiTable
          id="input-attributes"
          label="Attribute"
          typeLabel="Value"
          entries={[
            {
              name: 'role',
              type: <code>{'combobox'}</code>,
              description: 'Editable value-picker semantics.',
            },
            {
              name: 'aria-autocomplete',
              type: <code>{'list'}</code>,
              description: 'List suggestions for typed text.',
            },
            {
              name: 'aria-haspopup',
              type: <code>{'listbox'}</code>,
              description: 'Popup semantics.',
            },
            {
              name: 'aria-expanded',
              type: <code>{'true | false'}</code>,
              description: 'Logical open state.',
            },
            {
              name: 'aria-controls',
              type: <code>{'string'}</code>,
              description: 'Generated list ID.',
            },
            {
              name: 'aria-activedescendant',
              type: <code>{'string | absent'}</code>,
              description: 'Highlighted option ID.',
            },
            {
              name: 'data-surface-visible',
              type: <code>{'true | absent'}</code>,
              description: 'Whether the result surface is visible.',
            },
            {
              name: 'autocomplete',
              type: <code>{'off'}</code>,
              description: 'Default. Host autocomplete can override it.',
            },
            {
              name: 'type',
              type: <code>{'text'}</code>,
              description: 'Default. Host type can override it.',
            },
            {
              name: 'disabled',
              type: <code>{'true | absent'}</code>,
              description: 'Provider or host disabled state.',
            },
          ]}
        />
        <h3 id="popover-reference">popover()</h3>
        <p>
          Synchronizes the popup minimum width to the input and anchors below it. Allows input
          clicks while open. Adds native <code>popover=&quot;manual&quot;</code> behavior.
        </p>
        <ApiTable
          id="popover-attributes"
          label="Attribute"
          typeLabel="Value"
          entries={[
            {
              name: 'data-show-reason',
              type: <code>{'hint | nav'}</code>,
              description: 'Typing hint or navigation session.',
            },
          ]}
        />
        <h3 id="list-reference">list()</h3>
        <ApiTable
          id="list-attributes"
          label="Attribute"
          typeLabel="Value"
          entries={[
            { name: 'role', type: <code>{'listbox'}</code>, description: 'Popup list semantics.' },
            { name: 'id', type: <code>{'string'}</code>, description: 'Generated list ID.' },
            {
              name: 'tabIndex',
              type: <code>{'-1'}</code>,
              description: 'Listbox default. Focus remains on the input.',
            },
          ]}
        />
        <h3 id="option-reference">option(options)</h3>
        <ApiTable
          id="option-options"
          label="Option"
          defaults
          entries={[
            {
              name: 'label',
              type: <code>{'string'}</code>,
              description:
                'Label displayed after pointer or keyboard selection. Blur matching preserves typed text.',
              required: true,
            },
            {
              name: 'value',
              type: <code>{'string'}</code>,
              description: 'Stable submitted value.',
              required: true,
            },
            {
              name: 'searchValue',
              type: <code>{'string | string[]'}</code>,
              description:
                'Search text or aliases. Filtering matches prefixes and blur matches the full string, ignoring case. Defaults to the label.',
              defaultValue: <code>{'label'}</code>,
            },
            {
              name: 'disabled',
              type: <code>{'boolean'}</code>,
              description: 'Prevents selection.',
              defaultValue: <code>{'false'}</code>,
            },
          ]}
        />
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
              name: 'hidden',
              type: <code>{'true | absent'}</code>,
              description: 'Non-matching filter results.',
            },
            {
              name: 'data-combobox-flash',
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
              description: 'Committed value or empty string.',
            },
            {
              name: 'disabled',
              type: <code>{'true | absent'}</code>,
              description: 'Context disabled state.',
            },
          ]}
        />
        <h3 id="handle-reference">ComboboxHandle</h3>
        <ApiTable
          id="handle-members"
          label="Member"
          entries={[
            {
              name: 'value',
              type: <code>{'string | null'}</code>,
              description:
                'Selected value. Updates before the selection flash finishes and the change event fires.',
            },
            {
              name: 'label',
              type: <code>{'string | null'}</code>,
              description:
                'Selected option label, which can differ from the typed text after alias matching.',
            },
            {
              name: 'inputText',
              type: <code>{'string'}</code>,
              description:
                'Logical input text. On selection, changes to the label before the visible input finishes closing.',
            },
            { name: 'isOpen', type: <code>{'boolean'}</code>, description: 'Logical open state.' },
            { name: 'id', type: <code>{'string'}</code>, description: 'List ID.' },
            {
              name: 'activeOptionId',
              type: <code>{'string | null'}</code>,
              description: 'Highlighted option ID.',
            },
            {
              name: 'open',
              type: <code>{'(strategy?: ComboboxOpenStrategy) => Promise<void>'}</code>,
              description:
                'Opens filtered results, or the full list for exact or unmatched text. Defaults to selected. No-op when disabled or no options are registered.',
            },
            { name: 'close', type: <code>{'() => void'}</code>, description: 'Requests closure.' },
          ]}
        />
        <ApiTable
          id="handle-strategies"
          label="Open strategy"
          entries={[
            {
              name: 'selected',
              type: <code>{'ComboboxOpenStrategy'}</code>,
              description:
                'Exact enabled draft match, then selected option, then first enabled result.',
            },
            {
              name: 'selected-or-none',
              type: <code>{'ComboboxOpenStrategy'}</code>,
              description: 'Selected option when it matches the filter. Otherwise no highlight.',
            },
            {
              name: 'first',
              type: <code>{'ComboboxOpenStrategy'}</code>,
              description: 'First enabled matching option.',
            },
            {
              name: 'last',
              type: <code>{'ComboboxOpenStrategy'}</code>,
              description: 'Last enabled matching option.',
            },
          ]}
        />
        <h3 id="change-listener-reference">onComboboxChange(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:combobox-change</code>. Receives the event and an abort signal.
          Capture defaults to false. Events bubble from the input, or the surface if no input is
          registered. They are not cancelable.
        </p>
        <h3 id="change-event-reference">ComboboxChangeEvent</h3>
        <ApiTable
          id="change-event-properties"
          label="Property"
          entries={[
            {
              name: 'value',
              type: <code>{'string | null'}</code>,
              description: 'Committed value.',
            },
            {
              name: 'label',
              type: <code>{'string | null'}</code>,
              description: 'Committed label.',
            },
            {
              name: 'optionId',
              type: <code>{'string | null'}</code>,
              description: 'Generated option ID.',
            },
          ]}
        />
        <p>
          Construct with <code>{'new ComboboxChangeEvent({ value, label, optionId })'}</code>.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable
          id="types-types"
          detailsLabel="Definition"
          entries={[
            {
              name: 'ComboboxContextProps',
              type: <code>{'interface'}</code>,
              description: 'Provider options.',
              id: 'type-ComboboxContextProps',
              details: <CodeBlock html={typeDefinitions.ComboboxContextProps} />,
            },
            {
              name: 'ComboboxOptionOptions',
              type: <code>{'interface'}</code>,
              description: 'Option identity, label, aliases and disabled state.',
              id: 'type-ComboboxOptionOptions',
              details: <CodeBlock html={typeDefinitions.ComboboxOptionOptions} />,
            },
            {
              name: 'ComboboxOpenStrategy',
              type: <code>{"'selected' | 'selected-or-none' | 'first' | 'last'"}</code>,
              description: 'Selected, selected-or-none, first or last.',
              id: 'type-ComboboxOpenStrategy',
              details: <CodeBlock html={typeDefinitions.ComboboxOpenStrategy} />,
            },
            {
              name: 'ComboboxHandle',
              type: <code>{'interface'}</code>,
              description: 'Live state and popup operations.',
              id: 'type-ComboboxHandle',
              details: <CodeBlock html={typeDefinitions.ComboboxHandle} />,
            },
          ]}
        />
      </Section>
    </PageLayout>
  )
}
