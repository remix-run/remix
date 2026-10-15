import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { referenceTable } from '../reference-table.tsx'

export const meta = {
  title: 'Combobox',
  slug: 'combobox',
  category: 'behaviors',
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

export default function ComboboxPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero compact />
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
          <code>defaultValue</code> sets the initial committed value. In the current implementation
          it also sets the input text to the value string. Selecting an option later replaces that
          text with its label. Combobox currently has no controlled <code>value</code> or{' '}
          <code>inputValue</code> prop.
        </p>

        <Example id="initial-example" example={initialExample} compact />
      </Section>
      <Section id="options" title="Filtering and aliases">
        <p>
          Typing filters options by case-insensitive substring matching. <code>searchValue</code>{' '}
          supplies a string or aliases in place of the label. Non-matching options receive{' '}
          <code>hidden</code>. Disabled options can remain visible but cannot be selected.
        </p>
        <Example id="rich-options-example" example={richOptionsExample} compact />
      </Section>
      <Section id="disabled" title="Disabled state">
        <p>
          <code>disabled</code> on <code>Context</code> disables the input and hidden input.
          Disabled options are skipped during highlighting and selection.
        </p>
        <Example id="disabled-example" example={disabledExample} compact />
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

        <Example id="form-example" example={formExample} compact />
      </Section>
      <Section id="events" title="Change events">
        <p>
          <code>onComboboxChange()</code> receives committed-value changes from the input or an
          ancestor. Its <code>value</code>, <code>label</code> and <code>optionId</code> become null
          when editing clears a selection. Recommitting an unchanged value does not dispatch another
          change.
        </p>
        <CodeBlock html={eventsCode} />
      </Section>
      <Section id="imperative" title="Imperative access">
        <p>
          The provider’s <code>ref</code> receives a <code>ComboboxHandle</code>.{' '}
          <code>open()</code> can start at the selected option, an enabled boundary or no option.{' '}
          <code>close()</code> dismisses the popup without exposing its DOM.
        </p>
        <Example id="imperative-example" example={imperativeExample} compact />
      </Section>
      <Section id="feedback" title="Popup and selection feedback">
        <p>
          <code>data-combobox-flash</code> marks a fixed 60 ms selection flash. The committed-value
          change event fires after the flash, before closing starts.
        </p>
        <p>
          Navigation opens the surface with <code>data-show-reason="nav"</code>. The selected label
          appears 50 ms after its close transition. This delay is fixed. Typing uses{' '}
          <code>data-show-reason="hint"</code> and skips the close transition. The input’s{' '}
          <code>data-surface-visible</code> stays present through a navigation close.
        </p>
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Focus stays on the text input during arrow navigation and pointer selection. Arrow keys
          open results or change the highlight. Enter selects the highlight. Escape dismisses the
          popup. Tab moves focus away and triggers blur matching. Give the input a visible label and
          the list an accessible name.
        </p>
        <CodeBlock html={accessibilityCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            [
              'defaultValue',
              'string | null',
              'Initial committed value and initial draft text. Defaults to null.',
            ],
            ['disabled', 'boolean', 'Defaults to false. Disables input and hidden input.'],
            ['name', 'string', 'Form field name for the committed value.'],
            [
              'ref',
              '(handle: ComboboxHandle) => void',
              'Receives a live imperative handle once after mounting.',
            ],
            ['children', 'RemixNode', 'Input, surface, list, options and hidden input.'],
          ],
        )}
        <h3 id="input-reference">input()</h3>
        <p>
          On blur, an exact match against an enabled option’s search values selects that option.
          Search values default to the label and can be replaced with <code>searchValue</code>.
          Unmatched text and selection are cleared.
        </p>
        <p>
          Escape closes the list and clears unmatched text and selection. Exact matches remain in
          the input, but Escape alone does not select them.
        </p>
        {referenceTable(
          ['Decoration', 'Values or default', 'Meaning'],
          [
            ['role', 'combobox', 'Editable value-picker semantics.'],
            ['aria-autocomplete', 'list', 'List suggestions for typed text.'],
            ['aria-haspopup', 'listbox', 'Popup semantics.'],
            ['aria-expanded', 'true | false', 'Logical open state.'],
            ['aria-controls', 'string', 'Generated list ID.'],
            ['aria-activedescendant', 'string | absent', 'Highlighted option ID.'],
            ['data-surface-visible', 'true | absent', 'Whether the result surface is visible.'],
            ['autocomplete', 'off', 'Default. Host autocomplete can override it.'],
            ['type', 'text', 'Default. Host type can override it.'],
            ['disabled', 'true | absent', 'Provider or host disabled state.'],
          ],
        )}
        <h3 id="popover-reference">popover()</h3>
        <p>
          Synchronizes the popup minimum width to the input and anchors below it. Allows input
          clicks while open. Adds native <code>popover=&quot;manual&quot;</code> behavior.
        </p>
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [['data-show-reason', 'hint | nav', 'Typing hint or navigation session.']],
        )}
        <h3 id="list-reference">list()</h3>
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['role', 'listbox', 'Popup list semantics.'],
            ['id', 'string', 'Generated list ID.'],
            ['tabIndex', '-1', 'Listbox default. Focus remains on the input.'],
          ],
        )}
        <h3 id="option-reference">option(options)</h3>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            ['label', 'string', 'Required. Committed visible input label.'],
            ['value', 'string', 'Required stable submitted value.'],
            ['searchValue', 'string | string[]', 'Search aliases. Defaults to label.'],
            ['disabled', 'boolean', 'Prevents selection. Defaults to false.'],
          ],
        )}
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['role', 'option', 'Option semantics.'],
            ['id', 'string', 'Generated option ID.'],
            ['aria-selected, aria-disabled', 'true | false', 'Selected and disabled state.'],
            ['data-highlighted', 'true | false', 'Highlighted state.'],
            ['hidden', 'true | absent', 'Non-matching filter results.'],
            ['data-combobox-flash', 'true | absent', 'Temporary selection feedback.'],
          ],
        )}
        <h3 id="hidden-input-reference">hiddenInput()</h3>
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['type', 'hidden', 'Native hidden input.'],
            ['name', 'string | absent', 'Context name.'],
            ['value', 'string', 'Committed value or empty string.'],
            ['disabled', 'true | absent', 'Context disabled state.'],
          ],
        )}
        <h3 id="handle-reference">ComboboxHandle</h3>
        {referenceTable(
          ['Member', 'Type or result', 'Meaning'],
          [
            ['value, label', 'string | null', 'Committed value and option label.'],
            ['inputText', 'string', 'Current draft text.'],
            ['isOpen', 'boolean', 'Logical open state.'],
            ['id', 'string', 'List ID.'],
            ['activeOptionId', 'string | null', 'Highlighted option ID.'],
            [
              'open(strategy?)',
              'Promise<void>',
              'Opens matching results. Defaults to selected. No-op when disabled or no results match.',
            ],
            ['close()', 'void', 'Requests closure.'],
          ],
        )}
        {referenceTable(
          ['Open strategy', 'Behavior'],
          [
            ['selected', 'Selected option, exact draft match or enabled fallback.'],
            [
              'selected-or-none',
              'Selected option when it matches the filter. Otherwise no highlight.',
            ],
            ['first', 'First enabled matching option.'],
            ['last', 'Last enabled matching option.'],
          ],
        )}
        <h3 id="change-listener-reference">onComboboxChange(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:combobox-change</code>. Receives the event and an abort signal.
          Capture defaults to false.
        </p>
        <h3 id="change-event-reference">ComboboxChangeEvent</h3>
        {referenceTable(
          ['Property', 'Type', 'Meaning'],
          [
            ['value', 'string | null', 'Committed value.'],
            ['label', 'string | null', 'Committed label.'],
            ['optionId', 'string | null', 'Generated option ID.'],
          ],
        )}
        <h3 id="types-reference">Exported types</h3>
        {referenceTable(
          ['Type', 'Purpose'],
          [
            ['ComboboxContextProps', 'Provider options.'],
            ['ComboboxOptionOptions', 'Option identity, label, aliases and disabled state.'],
            ['ComboboxOpenStrategy', 'selected, selected-or-none, first or last.'],
            ['ComboboxHandle', 'Live state and popup operations.'],
          ],
        )}
      </Section>
    </PageLayout>
  )
}
