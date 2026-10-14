import type { UiDocs } from './docs/types.ts'
import { referenceTable } from './docs/reference-table.tsx'

export default {
  title: 'Listbox',
  slug: 'listbox',
  category: 'primitives',
  description:
    'Single-value selection with independent highlighting and typeahead when the list has keyboard focus.',
  importPath: '@remix-run/ui/listbox',
  examples: [
    {
      id: 'basic',
      title: 'Basic',
      description: '',
      module: new URL('./listbox/basic.example.tsx', import.meta.url),
    },
    {
      id: 'rich-options-example',
      title: 'Rich options',
      description: '',
      section: 'options',
      module: new URL('./listbox/rich-options.example.tsx', import.meta.url),
    },
    {
      id: 'settled-example',
      title: 'Settled',
      description: '',
      section: 'settling',
      module: new URL('./listbox/settled.example.tsx', import.meta.url),
    },
  ],
  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy',
      content() {
        return <p>Provide selection and highlight state, then apply list and option mixins.</p>
      },
      code: [
        {
          source:
            "import * as listbox from '@remix-run/ui/listbox'\n\n<listbox.Context\n  value={value}\n  activeValue={activeValue}\n  onSelect={(next) => { value = next\n    handle.update() }}\n  onHighlight={(next) => { activeValue = next\n    handle.update() }}\n>\n  <div tabIndex={0} aria-label=\"Teams\" mix={listbox.list()}>\n    <div mix={listbox.option({ label: 'Design', value: 'design' })}>Design</div>\n    <div mix={listbox.option({ label: 'Engineering', value: 'engineering' })}>Engineering</div>\n  </div>\n</listbox.Context>",
        },
      ],
    },
    {
      id: 'state',
      title: 'Selection and highlighting',
      content() {
        return (
          <p>
            <code>value</code> identifies the selected option. <code>activeValue</code> identifies
            the highlighted option. Both accept a string or null and must be managed through{' '}
            <code>onSelect</code> and <code>onHighlight</code>. Moving the highlight does not select
            an option.
          </p>
        )
      },
      code: [
        {
          source:
            'let value: string | null = null\nlet activeValue: string | null = null\nlet activeId: string | undefined\n\n<listbox.Context\n  value={value}\n  activeValue={activeValue}\n  onSelect={(next) => { value = next\n    handle.update() }}\n  onHighlight={(next, option) => {\n    activeValue = next\n    activeId = option?.id\n    handle.update()\n  }}\n>\n  <div tabIndex={0} aria-label="Teams" aria-activedescendant={activeId} mix={listbox.list()}>\n    {/* Options */}\n  </div>\n</listbox.Context>',
        },
      ],
    },
    {
      id: 'options',
      title: 'Option labels and availability',
      content() {
        return (
          <p>
            <code>label</code> supplies option metadata. Rendered children can include secondary
            text. <code>textValue</code> supplies a string or aliases for typeahead. Disabled and
            hidden options are excluded from navigation, typeahead and selection.
          </p>
        )
      },
    },
    {
      id: 'settling',
      title: 'Selection feedback',
      content() {
        return (
          <p>
            <code>flashSelection</code> adds a temporary attribute to the selected option.{' '}
            <code>onSelect</code> runs immediately. <code>onSelectSettled</code> runs after the
            flash. Highlight and selection requests are ignored while selection settles.
          </p>
        )
      },
    },
    {
      id: 'imperative',
      title: 'Imperative access',
      content() {
        return (
          <p>
            The provider’s <code>ref</code> receives a live <code>ListboxRef</code>. Read registered
            options, navigate, search or select without reaching into the DOM.
          </p>
        )
      },
      code: [
        {
          source:
            "let control: listbox.ListboxRef | undefined\n\n<listbox.Context\n  value={value}\n  activeValue={activeValue}\n  onSelect={onSelect}\n  onHighlight={onHighlight}\n  ref={(next) => { control = next }}\n>\n  {/* List and options */}\n</listbox.Context>\n\ncontrol?.highlightSearchMatch('design')\nawait control?.selectActive()",
        },
      ],
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      content() {
        return (
          <p>
            Give a standalone list an accessible name and <code>tabIndex={0}</code>. Focus stays on
            the list while the highlight moves. Supply <code>aria-activedescendant</code> from the
            highlighted option’s ID. ArrowDown wraps to the first option. ArrowUp stops at the first
            option. Home and End move to the boundaries. Enter and Space select. Typing while the
            list is focused highlights the next label or alias that starts with those characters
            without selecting it. The current list mixin intercepts Tab to highlight the first
            option and does not provide Escape dismissal.
          </p>
        )
      },
      code: [
        {
          source:
            '<div\n  tabIndex={0}\n  aria-label="Teams"\n  aria-activedescendant={activeId}\n  mix={listbox.list()}\n/>',
        },
      ],
    },
    {
      id: 'api-reference',
      title: 'API reference',
      content() {
        return (
          <>
            <h3 id="context-reference">Context</h3>
            <p>
              Requires controlled selection and highlight state. Provides{' '}
              <code>ListboxContext</code> and optionally a <code>ListboxRef</code>.
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
                [
                  'ref',
                  '(ref: ListboxRef) => void',
                  'Receives live option metadata and operations.',
                ],
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
                [
                  'scrollActiveOptionIntoView()',
                  'void',
                  'Scrolls the highlighted option into view.',
                ],
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
          </>
        )
      },
    },
  ],
} satisfies UiDocs
