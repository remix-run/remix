import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Listbox',
  slug: 'listbox',
  category: 'patterns',
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

const typeDefinitions = {
  ListboxValue: await highlightSource(`export type ListboxValue = string | null`),
  ListboxProviderProps: await highlightSource(
    `export interface ListboxProviderProps {
  value: ListboxValue
  activeValue: ListboxValue

  children?: RemixNode
  ref?: (ref: ListboxRef) => void
  flashSelection?: boolean
  selectionFlashAttribute?: string
  onSelect: (value: ListboxValue, option?: ListboxRegisteredOption) => void
  onSelectSettled?: (value: ListboxValue, option?: ListboxRegisteredOption) => void | Promise<void>
  onHighlight: (value: ListboxValue, option?: ListboxRegisteredOption) => void
}`,
  ),
  ListboxContext: await highlightSource(
    `export interface ListboxContext {
  value: ListboxValue
  activeValue: ListboxValue

  registerOption: (option: ListboxRegisteredOption) => void
  select: (value: ListboxValue) => Promise<void>
  highlight: (value: ListboxValue) => void
  highlightSearchMatch: (text: string) => void
  navigate: (direction: 'next' | 'previous' | 'first' | 'last') => void
  scrollActiveOptionIntoView: () => void
}`,
  ),
  ListboxOption: await highlightSource(
    `export interface ListboxOption {
  id: string
  value: string
  label: string
  disabled?: boolean
  textValue?: string | string[]
}`,
  ),
  ListboxRegisteredOption: await highlightSource(
    `export interface ListboxRegisteredOption extends ListboxOption {
  readonly hidden: boolean
  readonly node: HTMLElement
}`,
  ),
  ListboxRef: await highlightSource(
    `export interface ListboxRef {
  active: ListboxRegisteredOption | undefined
  options: ReadonlyArray<ListboxRegisteredOption>
  selected: ListboxRegisteredOption | undefined
  highlight: (value: ListboxValue) => void
  highlightSearchMatch: (text: string) => void
  matchSearchText: (text: string, fromValue?: ListboxValue) => ListboxRegisteredOption | null
  navigateFirst: () => void
  navigateLast: () => void
  navigateNext: () => void
  navigatePrevious: () => void
  scrollActiveOptionIntoView: () => void
  select: (value: ListboxValue) => Promise<void>
  selectActive: () => Promise<void>
}`,
  ),
}

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
          options are excluded from navigation, typeahead and selection. Hide an option with its
          native <code>hidden</code> attribute so the library can detect it.
        </p>
        <Example id="rich-options-example" example={richOptionsExample} />
      </Section>
      <Section id="settling" title="Selection feedback">
        <p>
          <code>flashSelection</code> adds a temporary attribute to the selected option.{' '}
          <code>onSelect</code> runs immediately. <code>onSelectSettled</code> runs after the fixed
          60 ms flash when enabled, or immediately after <code>onSelect</code> otherwise. Highlight
          and selection requests are ignored until <code>onSelectSettled</code> finishes.
        </p>
        <CodeBlock html={settlingCode} />
      </Section>
      <Section id="imperative" title="Imperative access">
        <p>
          The provider's <code>ref</code> receives a <code>ListboxRef</code> for reading registered
          options, navigating, searching and selecting programmatically.
        </p>
        <CodeBlock html={imperativeCode} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Give a standalone list an accessible name and <code>tabIndex={0}</code>. Focus stays on
          the list while the highlight moves. Supply <code>aria-activedescendant</code> from the
          highlighted option's ID.
        </p>
        <CodeBlock html={accessibilityCode} />
        <ul>
          <li>ArrowDown moves the highlight forward and wraps to the first option.</li>
          <li>ArrowUp moves backward and stops at the first option.</li>
          <li>Home and End highlight the first and last options.</li>
          <li>Enter and Space select the highlighted option.</li>
          <li>
            Typing highlights the next label or alias that starts with those characters without
            selecting it.
          </li>
        </ul>
        <p>The list mixin intercepts Tab to highlight the first option.</p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <p>
          Requires controlled selection and highlight state. Provides <code>ListboxContext</code>{' '}
          and optionally a <code>ListboxRef</code>.
        </p>
        <ApiTable
          id="context-options"
          label="Option"
          defaults
          entries={[
            {
              name: 'value',
              type: <code>{'string | null'}</code>,
              description: 'Selected value.',
              required: true,
            },
            {
              name: 'activeValue',
              type: <code>{'string | null'}</code>,
              description: 'Highlighted value.',
              required: true,
            },
            {
              name: 'onSelect',
              type: (
                <code>{'(value: ListboxValue, option?: ListboxRegisteredOption) => void'}</code>
              ),
              description: 'Receives the requested value and registered option.',
              required: true,
            },
            {
              name: 'onHighlight',
              type: (
                <code>{'(value: ListboxValue, option?: ListboxRegisteredOption) => void'}</code>
              ),
              description: 'Receives the requested highlight and registered option.',
              required: true,
            },
            {
              name: 'onSelectSettled',
              type: (
                <code>
                  {
                    '(value: ListboxValue, option?: ListboxRegisteredOption) => void | Promise<void>'
                  }
                </code>
              ),
              description: 'Runs after optional selection feedback.',
            },
            {
              name: 'flashSelection',
              type: <code>{'boolean'}</code>,
              description: 'Adds a 60 millisecond selection flash.',
              defaultValue: <code>{'false'}</code>,
            },
            {
              name: 'selectionFlashAttribute',
              type: <code>{'string'}</code>,
              description: 'Attribute applied during selection feedback.',
              defaultValue: <code>{"'data-listbox-flash'"}</code>,
            },
            {
              name: 'ref',
              type: <code>{'(ref: ListboxRef) => void'}</code>,
              description: 'Receives live option metadata and operations.',
            },
            {
              name: 'children',
              type: <code>{'RemixNode'}</code>,
              description: 'List and options.',
            },
          ]}
        />
        <h3 id="list-reference">list()</h3>
        <p>
          Handles keyboard navigation and typeahead. Supply an accessible name and{' '}
          <code>aria-activedescendant</code> from the highlighted option’s ID.
        </p>
        <ApiTable
          id="list-attributes"
          label="Attribute"
          typeLabel="Value"
          entries={[
            {
              name: 'role',
              type: <code>{'listbox'}</code>,
              description: 'Can be overridden by the host role.',
            },
            {
              name: 'tabIndex',
              type: <code>{'-1'}</code>,
              description: 'Default. Can be overridden on the host.',
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
              name: 'value',
              type: <code>{'string'}</code>,
              description: 'Stable identifier.',
              required: true,
            },
            {
              name: 'label',
              type: <code>{'string'}</code>,
              description: 'Label metadata.',
              required: true,
            },
            {
              name: 'textValue',
              type: <code>{'string | string[]'}</code>,
              description: 'Typeahead search text.',
              defaultValue: <code>{'label'}</code>,
            },
            {
              name: 'disabled',
              type: <code>{'boolean'}</code>,
              description: 'Prevents interactions.',
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
              name: 'aria-selected',
              type: <code>{'true | false'}</code>,
              description: 'Matches Context value.',
            },
            {
              name: 'aria-disabled',
              type: <code>{'true | false'}</code>,
              description: 'Reflects disabled.',
            },
            {
              name: 'data-highlighted',
              type: <code>{'true | false'}</code>,
              description: 'Matches Context activeValue.',
            },
          ]}
        />
        <h3 id="ref-reference">ListboxRef</h3>
        <ApiTable
          id="ref-members"
          label="Member"
          entries={[
            {
              name: 'options',
              type: <code>{'readonly ListboxRegisteredOption[]'}</code>,
              description: 'Registered options, including disabled and hidden options.',
            },
            {
              name: 'active',
              type: <code>{'ListboxRegisteredOption | undefined'}</code>,
              description: 'Current highlighted option.',
            },
            {
              name: 'selected',
              type: <code>{'ListboxRegisteredOption | undefined'}</code>,
              description: 'Current selected option.',
            },
            {
              name: 'highlight',
              type: <code>{'(value: ListboxValue) => void'}</code>,
              description:
                'Requests a highlight without checking availability. Null clears it. Unlike navigation, this does not scroll the option into view.',
            },
            {
              name: 'highlightSearchMatch',
              type: <code>{'(text: string) => void'}</code>,
              description: 'Highlights and scrolls to the next enabled match.',
            },
            {
              name: 'matchSearchText',
              type: (
                <code>
                  {'(text: string, fromValue?: ListboxValue) => ListboxRegisteredOption | null'}
                </code>
              ),
              description:
                'Finds a match without changing state. Starts after activeValue by default.',
            },
            {
              name: 'navigateFirst',
              type: <code>{'() => void'}</code>,
              description: 'Highlights and scrolls to the first enabled visible option.',
            },
            {
              name: 'navigateLast',
              type: <code>{'() => void'}</code>,
              description: 'Highlights and scrolls to the last enabled visible option.',
            },
            {
              name: 'navigateNext',
              type: <code>{'() => void'}</code>,
              description: 'Highlights the next enabled visible option, wrapping at the end.',
            },
            {
              name: 'navigatePrevious',
              type: <code>{'() => void'}</code>,
              description:
                'Highlights the previous enabled visible option. Stops at the first, or starts at the last when none is highlighted.',
            },
            {
              name: 'scrollActiveOptionIntoView',
              type: <code>{'() => void'}</code>,
              description: 'Scrolls the highlighted option into view.',
            },
            {
              name: 'select',
              type: <code>{'(value: ListboxValue) => Promise<void>'}</code>,
              description:
                'Requests selection of an enabled visible option and waits for settling. Null and unknown values are ignored.',
            },
            {
              name: 'selectActive',
              type: <code>{'() => Promise<void>'}</code>,
              description:
                'Selects the current highlight and waits for settling. Disabled and hidden options are ignored.',
            },
          ]}
        />
        <h3 id="provided-context-reference">Provided context</h3>
        <ApiTable
          id="provided-context-members"
          label="Member"
          entries={[
            {
              name: 'value',
              type: <code>{'ListboxValue'}</code>,
              description: 'Current selected value.',
            },
            {
              name: 'activeValue',
              type: <code>{'ListboxValue'}</code>,
              description: 'Current highlighted value.',
            },
            {
              name: 'select',
              type: <code>{'(value: ListboxValue) => Promise<void>'}</code>,
              description: 'Selection request and settling.',
            },
            {
              name: 'highlight',
              type: <code>{'(value: ListboxValue) => void'}</code>,
              description:
                'Requests a highlight without checking availability or scrolling. Null clears it.',
            },
            {
              name: 'highlightSearchMatch',
              type: <code>{'(text: string) => void'}</code>,
              description: 'Typeahead highlight.',
            },
            {
              name: 'navigate',
              type: <code>{"(direction: 'next' | 'previous' | 'first' | 'last') => void"}</code>,
              description: 'Accepts next, previous, first or last.',
            },
            {
              name: 'scrollActiveOptionIntoView',
              type: <code>{'() => void'}</code>,
              description: 'Scrolls the current highlight.',
            },
            {
              name: 'registerOption',
              type: <code>{'(option: ListboxRegisteredOption) => void'}</code>,
              description: 'Registration used by option().',
            },
          ]}
        />
        <h3 id="types-reference">Exported types</h3>
        <ApiTable
          id="types-types"
          detailsLabel="Definition"
          entries={[
            {
              name: 'ListboxValue',
              type: <code>{'string | null'}</code>,
              description: 'A selected or highlighted option value, or null.',
              id: 'type-ListboxValue',
              details: <CodeBlock html={typeDefinitions.ListboxValue} />,
            },
            {
              name: 'ListboxProviderProps',
              type: <code>{'interface'}</code>,
              description: 'Provider state, callbacks and feedback options.',
              id: 'type-ListboxProviderProps',
              details: <CodeBlock html={typeDefinitions.ListboxProviderProps} />,
            },
            {
              name: 'ListboxContext',
              type: <code>{'interface'}</code>,
              description: 'State and operations provided to descendants.',
              id: 'type-ListboxContext',
              details: <CodeBlock html={typeDefinitions.ListboxContext} />,
            },
            {
              name: 'ListboxOption',
              type: <code>{'interface'}</code>,
              description:
                'Id, value, label, disabled and textValue metadata. The option() mixin generates id.',
              id: 'type-ListboxOption',
              details: <CodeBlock html={typeDefinitions.ListboxOption} />,
            },
            {
              name: 'ListboxRegisteredOption',
              type: <code>{'interface'}</code>,
              description: 'Option metadata with readonly hidden and node.',
              id: 'type-ListboxRegisteredOption',
              details: <CodeBlock html={typeDefinitions.ListboxRegisteredOption} />,
            },
            {
              name: 'ListboxRef',
              type: <code>{'interface'}</code>,
              description: 'Live option access and imperative operations.',
              id: 'type-ListboxRef',
              details: <CodeBlock html={typeDefinitions.ListboxRef} />,
            },
          ]}
        />
      </Section>
    </PageLayout>
  )
}
