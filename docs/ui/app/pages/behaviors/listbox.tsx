import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { referenceTable } from '../reference-table.tsx'

export const meta = {
  title: 'Listbox',
  slug: 'listbox',
  category: 'behaviors',
  description:
    'Single-value selection with independent highlighting and typeahead when the list has keyboard focus.',
  importPath: '@remix-run/ui/listbox',
} satisfies PageMeta

const basic = await loadExample('listbox/basic')
const richOptionsExample = await loadExample('listbox/rich-options')

const anatomyCode = await highlightSource(`
  import * as listbox from '@remix-run/ui/listbox'

  <listbox.Context
    value={value}
    activeValue={activeValue}
    onSelect={(next) => { value = next
      handle.update() }}
    onHighlight={(next) => { activeValue = next
      handle.update() }}
  >
    <div tabIndex={0} aria-label="Teams" mix={listbox.list()}>
      <div mix={listbox.option({ label: 'Design', value: 'design' })}>Design</div>
      <div mix={listbox.option({ label: 'Engineering', value: 'engineering' })}>Engineering</div>
    </div>
  </listbox.Context>
`)

const stateCode = await highlightSource(`
  let value: string | null = null
  let activeValue: string | null = null
  let activeId: string | undefined

  <listbox.Context
    value={value}
    activeValue={activeValue}
    onSelect={(next) => { value = next
      handle.update() }}
    onHighlight={(next, option) => {
      activeValue = next
      activeId = option?.id
      handle.update()
    }}
  >
    <div tabIndex={0} aria-label="Teams" aria-activedescendant={activeId} mix={listbox.list()}>
      {/* Options */}
    </div>
  </listbox.Context>
`)

const settlingCode = await highlightSource(`
  <listbox.Context
    value={value}
    activeValue={activeValue}
    onSelect={onSelect}
    onHighlight={onHighlight}
    flashSelection
    onSelectSettled={(value, option) => {
      saveSelection(value, option?.label)
    }}
  >
    {/* List and options */}
  </listbox.Context>
`)

const imperativeCode = await highlightSource(`
  let control: listbox.ListboxRef | undefined

  <listbox.Context
    value={value}
    activeValue={activeValue}
    onSelect={onSelect}
    onHighlight={onHighlight}
    ref={(listboxRef) => { control = listboxRef }}
  >
    {/* List and options */}
  </listbox.Context>

  control?.highlightSearchMatch('design')
  await control?.selectActive()
`)

const accessibilityCode = await highlightSource(`
  <div
    tabIndex={0}
    aria-label="Teams"
    aria-activedescendant={activeId}
    mix={listbox.list()}
  />
`)

export default function ListboxPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <p>Provide selection and highlight state, then apply list and option mixins.</p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="state" title="Selection and highlighting">
        <p>
          <code>value</code> identifies the selected option. <code>activeValue</code> identifies the
          highlighted option. Both accept a string or null and must be managed through{' '}
          <code>onSelect</code> and <code>onHighlight</code>. Moving the highlight does not select
          an option.
        </p>
        <CodeBlock html={stateCode} />
      </Section>
      <Section id="options" title="Option labels and availability">
        <p>
          <code>label</code> supplies option metadata. Rendered children can include secondary text.{' '}
          <code>textValue</code> supplies a string or aliases for typeahead. Disabled and hidden
          options are excluded from navigation, typeahead and selection.
        </p>
        <Example id="rich-options-example" example={richOptionsExample} />
      </Section>
      <Section id="settling" title="Selection feedback">
        <p>
          <code>flashSelection</code> adds a temporary attribute to the selected option.{' '}
          <code>onSelect</code> runs immediately. <code>onSelectSettled</code> runs after the fixed
          60 ms flash. Its duration is not configurable. Highlight and selection requests are
          ignored while selection settles.
        </p>
        <CodeBlock html={settlingCode} />
      </Section>
      <Section id="imperative" title="Imperative access">
        <p>
          The provider’s <code>ref</code> receives a live <code>ListboxRef</code>. Read registered
          options, navigate, search or select without reaching into the DOM.
        </p>
        <CodeBlock html={imperativeCode} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Give a standalone list an accessible name and <code>tabIndex={0}</code>. Focus stays on
          the list while the highlight moves. Supply <code>aria-activedescendant</code> from the
          highlighted option’s ID. ArrowDown wraps to the first option. ArrowUp stops at the first
          option. Home and End move to the boundaries. Enter and Space select. Typing while the list
          is focused highlights the next label or alias that starts with those characters without
          selecting it. The current list mixin intercepts Tab to highlight the first option and does
          not provide Escape dismissal.
        </p>
        <CodeBlock html={accessibilityCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <p>
          Requires controlled selection and highlight state. Provides <code>ListboxContext</code>{' '}
          and optionally a <code>ListboxRef</code>.
        </p>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            ['value', 'string | null', 'Required selected value.'],
            ['activeValue', 'string | null', 'Required highlighted value.'],
            [
              'onSelect',
              '(value: ListboxValue, option?: ListboxRegisteredOption) => void',
              'Required. Receives the requested value and registered option.',
            ],
            [
              'onHighlight',
              '(value: ListboxValue, option?: ListboxRegisteredOption) => void',
              'Required. Receives the requested highlight and registered option.',
            ],
            [
              'onSelectSettled',
              '(value: ListboxValue, option?: ListboxRegisteredOption) => void | Promise<void>',
              'Runs after optional selection feedback.',
            ],
            [
              'flashSelection',
              'boolean',
              'Defaults to false. Adds a 60 millisecond selection flash.',
            ],
            ['selectionFlashAttribute', 'string', 'Defaults to data-listbox-flash.'],
            ['ref', '(ref: ListboxRef) => void', 'Receives live option metadata and operations.'],
            ['children', 'RemixNode', 'List and options.'],
          ],
        )}
        <h3 id="list-reference">list()</h3>
        <p>
          Handles keyboard navigation and typeahead. It does not set{' '}
          <code>aria-activedescendant</code> or a label.
        </p>
        {referenceTable(
          ['Decoration', 'Default', 'Meaning'],
          [
            ['role', 'listbox', 'Can be overridden by the host role.'],
            ['tabIndex', '-1', 'Default. Can be overridden on the host.'],
          ],
        )}
        <h3 id="option-reference">option(options)</h3>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            ['value', 'string', 'Required stable identifier.'],
            ['label', 'string', 'Required label metadata.'],
            ['textValue', 'string | string[]', 'Typeahead search text. Defaults to label.'],
            ['disabled', 'boolean', 'Defaults to false. Prevents interactions.'],
          ],
        )}
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['role', 'option', 'Option semantics.'],
            ['id', 'string', 'Generated option ID.'],
            ['aria-selected', 'true | false', 'Matches Context value.'],
            ['aria-disabled', 'true | false', 'Reflects disabled.'],
            ['data-highlighted', 'true | false', 'Matches Context activeValue.'],
          ],
        )}
        <h3 id="ref-reference">ListboxRef</h3>
        {referenceTable(
          ['Member', 'Type or result', 'Meaning'],
          [
            [
              'options',
              'readonly ListboxRegisteredOption[]',
              'Registered options, including disabled and hidden options.',
            ],
            [
              'active, selected',
              'ListboxRegisteredOption | undefined',
              'Current highlighted and selected options.',
            ],
            ['highlight(value)', 'void', 'Requests a highlight, including null to clear it.'],
            [
              'highlightSearchMatch(text)',
              'void',
              'Highlights and scrolls to the next enabled match.',
            ],
            [
              'matchSearchText(text, fromValue?)',
              'ListboxRegisteredOption | null',
              'Finds a match without changing state. Starts after activeValue by default.',
            ],
            [
              'navigateFirst(), navigateLast(), navigateNext(), navigatePrevious()',
              'void',
              'Requests and scrolls a new highlight.',
            ],
            ['scrollActiveOptionIntoView()', 'void', 'Scrolls the highlighted option into view.'],
            [
              'select(value), selectActive()',
              'Promise<void>',
              'Requests selection of an enabled visible option and waits for settling. Null and unknown values are ignored.',
            ],
          ],
        )}
        <h3 id="provided-context-reference">Provided context</h3>
        {referenceTable(
          ['Member', 'Type or result', 'Meaning'],
          [
            ['value, activeValue', 'string | null', 'Current controlled state.'],
            ['select(value)', 'Promise<void>', 'Selection request and settling.'],
            ['highlight(value)', 'void', 'Highlight request.'],
            ['highlightSearchMatch(text)', 'void', 'Typeahead highlight.'],
            ['navigate(direction)', 'void', 'Accepts next, previous, first or last.'],
            ['scrollActiveOptionIntoView()', 'void', 'Scrolls the current highlight.'],
            ['registerOption(option)', 'void', 'Registration used by option().'],
          ],
        )}
        <h3 id="types-reference">Exported types</h3>
        {referenceTable(
          ['Type', 'Purpose'],
          [
            ['ListboxValue', 'string | null for selection or highlighting.'],
            ['ListboxProviderProps', 'Provider state, callbacks and feedback options.'],
            ['ListboxContext', 'State and operations provided to descendants.'],
            [
              'ListboxOption',
              'id, value, label, disabled and textValue metadata. The option() mixin generates id.',
            ],
            ['ListboxRegisteredOption', 'Option metadata with readonly hidden and node.'],
            ['ListboxRef', 'Live option access and imperative operations.'],
          ],
        )}
      </Section>
    </PageLayout>
  )
}
