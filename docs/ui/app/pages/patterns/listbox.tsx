import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Listbox',
  slug: 'listbox',
  category: 'patterns',
  description:
    'Single-value selection with independent highlighting and typeahead when the list has keyboard focus.',
  importPath: '@remix-run/ui/listbox',
} satisfies PageMeta

const basic = await loadExample('listbox/basic')
const groupedExample = await loadExample('listbox/grouped')
const richOptionsExample = await loadExample('listbox/rich-options')

const anatomyCode = await highlightSource(`
  import * as listbox from '@remix-run/ui/listbox'
  import { css } from 'remix/component'

  <listbox.Context
    value={value}
    activeValue={activeValue}
    onSelect={onSelect}
    onHighlight={onHighlight}
    flashSelection
  >
    <div
      tabIndex={0}
      aria-label="Options"
      aria-activedescendant={activeId}
      mix={[
        listbox.list(),
        css({
          '&:focus-visible': {},
        }),
      ]}
    >
      <div
        mix={[
          listbox.option({
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
            '&[data-listbox-flash]': {},
          }),
        ]}
      >
        Option text
      </div>
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
        <p>
          Keep option content noninteractive. Text, descriptions and decorative icons can share an
          option, but buttons, links and inputs need their own controls outside the list.
        </p>
        <Example id="rich-options-example" example={richOptionsExample} />
      </Section>
      <Section id="grouped" title="Grouped options">
        <p>
          Wrap related options in an element with <code>role="group"</code> and name it with{' '}
          <code>aria-labelledby</code> pointing to a visible group label. Keep labels outside the
          options so they name the group rather than becoming selectable items.
        </p>
        <p>
          Listbox handles navigation and typeahead across groups. Focus stays on the list, and
          moving the highlight leaves selection unchanged until an option is chosen.
        </p>
        <Example id="grouped-example" example={groupedExample} />
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
        <ApiTable id="context-options" label="Option" defaults>
          <ApiEntry name="value" type="string | null" required>
            Selected value.
          </ApiEntry>
          <ApiEntry name="activeValue" type="string | null" required>
            Highlighted value.
          </ApiEntry>
          <ApiEntry
            name="onSelect"
            type="(value: ListboxValue, option?: ListboxRegisteredOption) => void"
            required
          >
            Receives the requested value and registered option.
          </ApiEntry>
          <ApiEntry
            name="onHighlight"
            type="(value: ListboxValue, option?: ListboxRegisteredOption) => void"
            required
          >
            Receives the requested highlight and registered option.
          </ApiEntry>
          <ApiEntry
            name="onSelectSettled"
            type="(value: ListboxValue, option?: ListboxRegisteredOption) => void | Promise<void>"
          >
            Runs after optional selection feedback.
          </ApiEntry>
          <ApiEntry name="flashSelection" type="boolean" defaultValue="false">
            Adds a 60 millisecond selection flash.
          </ApiEntry>
          <ApiEntry
            name="selectionFlashAttribute"
            type="string"
            defaultValue="'data-listbox-flash'"
          >
            Attribute applied during selection feedback.
          </ApiEntry>
          <ApiEntry name="ref" type="(ref: ListboxRef) => void">
            Receives live option metadata and operations.
          </ApiEntry>
          <ApiEntry name="children" type="RemixNode">
            List and options.
          </ApiEntry>
        </ApiTable>
        <h3 id="list-reference">list()</h3>
        <p>
          Handles keyboard navigation and typeahead. Supply an accessible name and{' '}
          <code>aria-activedescendant</code> from the highlighted option’s ID.
        </p>
        <ApiTable id="list-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="listbox">
            Can be overridden by the host role.
          </ApiEntry>
          <ApiEntry name="tabIndex" type="-1">
            Default. Can be overridden on the host.
          </ApiEntry>
        </ApiTable>
        <h3 id="option-reference">option(options)</h3>
        <ApiTable id="option-options" label="Option" defaults>
          <ApiEntry name="value" type="string" required>
            Stable identifier.
          </ApiEntry>
          <ApiEntry name="label" type="string" required>
            Label metadata.
          </ApiEntry>
          <ApiEntry name="textValue" type="string | string[]" defaultValue="label">
            Typeahead search text.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean" defaultValue="false">
            Prevents interactions.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="option-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="option">
            Option semantics.
          </ApiEntry>
          <ApiEntry name="id" type="string">
            Generated option ID.
          </ApiEntry>
          <ApiEntry name="aria-selected" type="true | false">
            Matches Context value.
          </ApiEntry>
          <ApiEntry name="aria-disabled" type="true | false">
            Reflects disabled.
          </ApiEntry>
          <ApiEntry name="data-highlighted" type="true | false">
            Matches Context activeValue.
          </ApiEntry>
        </ApiTable>
        <h3 id="ref-reference">ListboxRef</h3>
        <ApiTable id="ref-members" label="Member">
          <ApiEntry name="options" type="readonly ListboxRegisteredOption[]">
            Registered options, including disabled and hidden options.
          </ApiEntry>
          <ApiEntry name="active" type="ListboxRegisteredOption | undefined">
            Current highlighted option.
          </ApiEntry>
          <ApiEntry name="selected" type="ListboxRegisteredOption | undefined">
            Current selected option.
          </ApiEntry>
          <ApiEntry name="highlight" type="(value: ListboxValue) => void">
            Requests a highlight without checking availability. Null clears it. Unlike navigation,
            this does not scroll the option into view.
          </ApiEntry>
          <ApiEntry name="highlightSearchMatch" type="(text: string) => void">
            Highlights and scrolls to the next enabled match.
          </ApiEntry>
          <ApiEntry
            name="matchSearchText"
            type="(text: string, fromValue?: ListboxValue) => ListboxRegisteredOption | null"
          >
            Finds a match without changing state. Starts after activeValue by default.
          </ApiEntry>
          <ApiEntry name="navigateFirst" type="() => void">
            Highlights and scrolls to the first enabled visible option.
          </ApiEntry>
          <ApiEntry name="navigateLast" type="() => void">
            Highlights and scrolls to the last enabled visible option.
          </ApiEntry>
          <ApiEntry name="navigateNext" type="() => void">
            Highlights the next enabled visible option, wrapping at the end.
          </ApiEntry>
          <ApiEntry name="navigatePrevious" type="() => void">
            Highlights the previous enabled visible option. Stops at the first, or starts at the
            last when none is highlighted.
          </ApiEntry>
          <ApiEntry name="scrollActiveOptionIntoView" type="() => void">
            Scrolls the highlighted option into view.
          </ApiEntry>
          <ApiEntry name="select" type="(value: ListboxValue) => Promise<void>">
            Requests selection of an enabled visible option and waits for settling. Null and unknown
            values are ignored.
          </ApiEntry>
          <ApiEntry name="selectActive" type="() => Promise<void>">
            Selects the current highlight and waits for settling. Disabled and hidden options are
            ignored.
          </ApiEntry>
        </ApiTable>
        <h3 id="provided-context-reference">Provided context</h3>
        <ApiTable id="provided-context-members" label="Member">
          <ApiEntry name="value" type="ListboxValue">
            Current selected value.
          </ApiEntry>
          <ApiEntry name="activeValue" type="ListboxValue">
            Current highlighted value.
          </ApiEntry>
          <ApiEntry name="select" type="(value: ListboxValue) => Promise<void>">
            Selection request and settling.
          </ApiEntry>
          <ApiEntry name="highlight" type="(value: ListboxValue) => void">
            Requests a highlight without checking availability or scrolling. Null clears it.
          </ApiEntry>
          <ApiEntry name="highlightSearchMatch" type="(text: string) => void">
            Typeahead highlight.
          </ApiEntry>
          <ApiEntry
            name="navigate"
            type="(direction: 'next' | 'previous' | 'first' | 'last') => void"
          >
            Accepts next, previous, first or last.
          </ApiEntry>
          <ApiEntry name="scrollActiveOptionIntoView" type="() => void">
            Scrolls the current highlight.
          </ApiEntry>
          <ApiEntry name="registerOption" type="(option: ListboxRegisteredOption) => void">
            Registration used by option().
          </ApiEntry>
        </ApiTable>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-ListboxValue" name="ListboxValue" type="string | null">
            <p>A selected or highlighted option value, or null.</p>
            <CodeBlock html={typeDefinitions.ListboxValue} />
          </ApiEntry>
          <ApiEntry id="type-ListboxProviderProps" name="ListboxProviderProps" type="interface">
            <p>Provider state, callbacks and feedback options.</p>
            <CodeBlock html={typeDefinitions.ListboxProviderProps} />
          </ApiEntry>
          <ApiEntry id="type-ListboxContext" name="ListboxContext" type="interface">
            <p>State and operations provided to descendants.</p>
            <CodeBlock html={typeDefinitions.ListboxContext} />
          </ApiEntry>
          <ApiEntry id="type-ListboxOption" name="ListboxOption" type="interface">
            <p>
              Id, value, label, disabled and textValue metadata. The option() mixin generates id.
            </p>
            <CodeBlock html={typeDefinitions.ListboxOption} />
          </ApiEntry>
          <ApiEntry
            id="type-ListboxRegisteredOption"
            name="ListboxRegisteredOption"
            type="interface"
          >
            <p>Option metadata with readonly hidden and node.</p>
            <CodeBlock html={typeDefinitions.ListboxRegisteredOption} />
          </ApiEntry>
          <ApiEntry id="type-ListboxRef" name="ListboxRef" type="interface">
            <p>Live option access and imperative operations.</p>
            <CodeBlock html={typeDefinitions.ListboxRef} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
