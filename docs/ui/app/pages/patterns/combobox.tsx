import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Combobox',
  slug: 'combobox',
  category: 'patterns',
  description: 'Filter options with editable text and commit a single value.',
  importPath: '@remix-run/ui/combobox',
} satisfies PageMeta

const basic = await loadExample('combobox/basic')
const richOptionsExample = await loadExample('combobox/rich-options')
const groupedExample = await loadExample('combobox/grouped')
const disabledExample = await loadExample('combobox/disabled')
const formExample = await loadExample('combobox/form')
const imperativeExample = await loadExample('combobox/imperative')

const anatomyCode = await highlightSource(`
  import * as combobox from '@remix-run/ui/combobox'
  import { css } from 'remix/component'

  <combobox.Context name="field-name">
    <label>
      Combobox label
      <input
        mix={[
          combobox.input(),
          css({
            '&:focus-visible': {},
            '&:disabled': {},
            '&[aria-expanded="true"]': {},
            '&[aria-expanded="false"]': {},
            '&[data-surface-visible]': {},
          }),
        ]}
      />
    </label>
    <div
      mix={[
        combobox.popover(),
        css({
          '&:popover-open': {},
          '&[data-show-reason="hint"]': {},
          '&[data-show-reason="nav"]': {},
        }),
      ]}
    >
      <div aria-label="Options" mix={combobox.list()}>
        <div
          mix={[
            combobox.option({
              label: 'Option text',
              value: 'option-value',
            }),
            css({
              '&[hidden]': {},
              '&[data-highlighted="true"]': {},
              '&[data-highlighted="false"]': {},
              '&[aria-selected="true"]': {},
              '&[aria-selected="false"]': {},
              '&[aria-disabled="true"]': {},
              '&[aria-disabled="false"]': {},
              '&[data-combobox-flash]': {},
            }),
          ]}
        >
          Option text
        </div>
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
  <>
    <label for="state">State</label>
    <input id="state" mix={combobox.input()} />
    <div aria-label="US states" mix={combobox.list()} />
  </>
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
    <PageLayout
      page={meta}
      pages={handle.props.pages}
      intro={
        <p>
          Combobox tracks the input text separately from the selected option’s value. The input text
          can contain an unfinished search. The selected value always identifies an accepted option.
          Editing clears the selected value, and choosing an option sets it again.
        </p>
      }
    >
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
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
          On blur, an exact enabled label or alias match commits the option and preserves the typed
          text. Partial or unmatched text is cleared.
        </p>
        <p>
          An empty search or a search with no matches closes the popup. Unmatched text stays in the
          input while editing. Clicking the closed input or pressing an arrow key reopens the full
          list when the text is an exact match or has no matches.
        </p>
        <p>
          The examples emphasize matching text in the option markup. The plain-text{' '}
          <code>label</code> still determines the selected label.
        </p>
        <p>
          Keep option content noninteractive. Use text and decorative icons for richer labels. Put
          buttons, links and other controls outside the options.
        </p>
        <Example id="rich-options-example" example={richOptionsExample} />
      </Section>
      <Section id="grouped" title="Grouped options">
        <p>
          Wrap related options in an element with <code>role="group"</code> and use{' '}
          <code>aria-labelledby</code> to associate it with a visible group label. Arrow keys move
          between options across groups.
        </p>
        <p>This example uses CSS to hide a group when all its options are hidden by filtering.</p>
        <Example id="grouped-example" example={groupedExample} />
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
        <ApiTable id="context-options" label="Option" defaults>
          <ApiEntry name="defaultValue" type="string | null" defaultValue="null">
            Initial committed value and initial draft text.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Disables input and hidden input.
          </ApiEntry>
          <ApiEntry name="name" type="string">
            Form field name for the committed value.
          </ApiEntry>
          <ApiEntry name="ref" type="(handle: ComboboxHandle) => void">
            Receives a live imperative handle once after mounting.
          </ApiEntry>
          <ApiEntry name="children" type="RemixNode">
            Input, surface, list, options and hidden input.
          </ApiEntry>
        </ApiTable>
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
        <ApiTable id="input-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="combobox">
            Editable value-picker semantics.
          </ApiEntry>
          <ApiEntry name="aria-autocomplete" type="list">
            List suggestions for typed text.
          </ApiEntry>
          <ApiEntry name="aria-haspopup" type="listbox">
            Popup semantics.
          </ApiEntry>
          <ApiEntry name="aria-expanded" type="true | false">
            Logical open state.
          </ApiEntry>
          <ApiEntry name="aria-controls" type="string">
            Generated list ID.
          </ApiEntry>
          <ApiEntry name="aria-activedescendant" type="string | absent">
            Highlighted option ID.
          </ApiEntry>
          <ApiEntry name="data-surface-visible" type="true | absent">
            Whether the result surface is visible.
          </ApiEntry>
          <ApiEntry name="autocomplete" type="off">
            Default. Host autocomplete can override it.
          </ApiEntry>
          <ApiEntry name="type" type="text">
            Default. Host type can override it.
          </ApiEntry>
          <ApiEntry name="disabled" type="true | absent">
            Provider or host disabled state.
          </ApiEntry>
        </ApiTable>
        <h3 id="popover-reference">popover()</h3>
        <p>
          Synchronizes the popup minimum width to the input and anchors below it. Allows input
          clicks while open. Adds native <code>popover=&quot;manual&quot;</code> behavior.
        </p>
        <ApiTable id="popover-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="data-show-reason" type="hint | nav">
            Typing hint or navigation session.
          </ApiEntry>
        </ApiTable>
        <h3 id="list-reference">list()</h3>
        <ApiTable id="list-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="listbox">
            Popup list semantics.
          </ApiEntry>
          <ApiEntry name="id" type="string">
            Generated list ID.
          </ApiEntry>
          <ApiEntry name="tabIndex" type="-1">
            Listbox default. Focus remains on the input.
          </ApiEntry>
        </ApiTable>
        <h3 id="option-reference">option(options)</h3>
        <ApiTable id="option-options" label="Option" defaults>
          <ApiEntry name="label" type="string" required>
            Label displayed after pointer or keyboard selection. Blur matching preserves typed text.
          </ApiEntry>
          <ApiEntry name="value" type="string" required>
            Stable submitted value.
          </ApiEntry>
          <ApiEntry name="searchValue" type="string | string[]" defaultValue="label">
            Search text or aliases. Filtering matches prefixes and blur matches the full string,
            ignoring case. Defaults to the label.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Prevents selection.
          </ApiEntry>
        </ApiTable>
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
          <ApiEntry name="hidden" type="true | absent">
            Non-matching filter results.
          </ApiEntry>
          <ApiEntry name="data-combobox-flash" type="true | absent">
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
            Committed value or empty string.
          </ApiEntry>
          <ApiEntry name="disabled" type="true | absent">
            Context disabled state.
          </ApiEntry>
        </ApiTable>
        <h3 id="handle-reference">ComboboxHandle</h3>
        <ApiTable id="handle-members" label="Member">
          <ApiEntry name="value" type="string | null">
            Selected value. Updates before the selection flash finishes and the change event fires.
          </ApiEntry>
          <ApiEntry name="label" type="string | null">
            Selected option label, which can differ from the typed text after alias matching.
          </ApiEntry>
          <ApiEntry name="inputText" type="string">
            Logical input text. On selection, changes to the label before the visible input finishes
            closing.
          </ApiEntry>
          <ApiEntry name="isOpen" type="boolean">
            Logical open state.
          </ApiEntry>
          <ApiEntry name="id" type="string">
            List ID.
          </ApiEntry>
          <ApiEntry name="activeOptionId" type="string | null">
            Highlighted option ID.
          </ApiEntry>
          <ApiEntry name="open" type="(strategy?: ComboboxOpenStrategy) => Promise<void>">
            Opens filtered results, or the full list for exact or unmatched text. Defaults to
            selected. No-op when disabled or no options are registered.
          </ApiEntry>
          <ApiEntry name="close" type="() => void">
            Requests closure.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="handle-strategies" label="Open strategy">
          <ApiEntry name="selected" type="ComboboxOpenStrategy">
            Exact enabled draft match, then selected option, then first enabled result.
          </ApiEntry>
          <ApiEntry name="selected-or-none" type="ComboboxOpenStrategy">
            Selected option when it matches the filter. Otherwise no highlight.
          </ApiEntry>
          <ApiEntry name="first" type="ComboboxOpenStrategy">
            First enabled matching option.
          </ApiEntry>
          <ApiEntry name="last" type="ComboboxOpenStrategy">
            Last enabled matching option.
          </ApiEntry>
        </ApiTable>
        <h3 id="change-listener-reference">onComboboxChange(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:combobox-change</code>. Receives the event and an abort signal.
          Capture defaults to false. Events bubble from the input, or the surface if no input is
          registered. They are not cancelable.
        </p>
        <h3 id="change-event-reference">ComboboxChangeEvent</h3>
        <ApiTable id="change-event-properties" label="Property">
          <ApiEntry name="value" type="string | null">
            Committed value.
          </ApiEntry>
          <ApiEntry name="label" type="string | null">
            Committed label.
          </ApiEntry>
          <ApiEntry name="optionId" type="string | null">
            Generated option ID.
          </ApiEntry>
        </ApiTable>
        <p>
          Construct with <code>{'new ComboboxChangeEvent({ value, label, optionId })'}</code>.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-ComboboxContextProps" name="ComboboxContextProps" type="interface">
            <p>Provider options.</p>
            <CodeBlock html={typeDefinitions.ComboboxContextProps} />
          </ApiEntry>
          <ApiEntry id="type-ComboboxOptionOptions" name="ComboboxOptionOptions" type="interface">
            <p>Option identity, label, aliases and disabled state.</p>
            <CodeBlock html={typeDefinitions.ComboboxOptionOptions} />
          </ApiEntry>
          <ApiEntry
            id="type-ComboboxOpenStrategy"
            name="ComboboxOpenStrategy"
            type="'selected' | 'selected-or-none' | 'first' | 'last'"
          >
            <p>Selected, selected-or-none, first or last.</p>
            <CodeBlock html={typeDefinitions.ComboboxOpenStrategy} />
          </ApiEntry>
          <ApiEntry id="type-ComboboxHandle" name="ComboboxHandle" type="interface">
            <p>Live state and popup operations.</p>
            <CodeBlock html={typeDefinitions.ComboboxHandle} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
