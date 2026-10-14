import type { UiDocs } from './docs/types.ts'
import { referenceTable } from './docs/reference-table.tsx'

export default {
  title: 'Select',
  slug: 'select',
  category: 'primitives',
  description: 'Choose a single value from a button-triggered option list.',
  importPath: '@remix-run/ui/select',
  examples: [
    {
      id: 'basic',
      title: 'Basic',
      description: '',
      previewSize: 'compact',
      module: new URL('./select/basic.example.tsx', import.meta.url),
    },
    {
      id: 'rich-options-example',
      title: 'Rich options',
      description: '',
      section: 'options',
      previewSize: 'compact',
      module: new URL('./select/rich-options.example.tsx', import.meta.url),
    },
    {
      id: 'disabled-example',
      title: 'Disabled',
      description: '',
      section: 'disabled',
      previewSize: 'compact',
      module: new URL('./select/disabled.example.tsx', import.meta.url),
    },
    {
      id: 'form-example',
      title: 'Form',
      description: '',
      section: 'forms',
      previewSize: 'compact',
      module: new URL('./select/form.example.tsx', import.meta.url),
    },
    {
      id: 'events-example',
      title: 'Events',
      description: '',
      section: 'events',
      previewSize: 'compact',
      module: new URL('./select/events.example.tsx', import.meta.url),
    },
  ],
  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy',
      content() {
        return (
          <p>
            Keep the trigger, popover, list and options inside the select provider. The surface also
            needs a Popover provider.
          </p>
        )
      },
      code: [
        {
          source:
            "import * as select from '@remix-run/ui/select'\nimport * as popover from '@remix-run/ui/popover'\n\n<select.Context defaultLabel=\"Choose delivery\">\n  <button type=\"button\" mix={select.trigger()}><SelectedLabel /></button>\n  <popover.Context>\n    <div mix={select.popover()}>\n      <div aria-label=\"Delivery methods\" mix={select.list()}>\n        <div mix={select.option({ label: 'Standard', value: 'standard' })}>Standard</div>\n        <div mix={select.option({ label: 'Express', value: 'express' })}>Express</div>\n      </div>\n    </div>\n  </popover.Context>\n</select.Context>\n\nfunction SelectedLabel(handle: Handle) {\n  let context = handle.context.get(select.Context)\n  return () => <span>{context.displayedLabel}</span>\n}",
        },
      ],
    },
    {
      id: 'initial',
      title: 'Initial selection',
      content() {
        return (
          <p>
            <code>defaultValue</code> sets the initial selected option. <code>defaultLabel</code>{' '}
            sets the initial trigger text independently. Read <code>displayedLabel</code> from{' '}
            <code>Context</code> to follow committed labels. Select currently has no controlled{' '}
            <code>value</code> prop or value-change callback.
          </p>
        )
      },
      code: [
        {
          source:
            '<select.Context defaultValue="standard" defaultLabel="Standard delivery">\n  {/* Trigger and options */}\n</select.Context>',
        },
      ],
    },
    {
      id: 'options',
      title: 'Option content and typeahead',
      content() {
        return (
          <p>
            The option’s <code>label</code> becomes the trigger text after selection. Its children
            can show richer content. <code>textValue</code> supplies a string or aliases for
            typeahead. Typeahead works in the popup and on the closed trigger. Closed-trigger
            matches select immediately.
          </p>
        )
      },
    },
    {
      id: 'disabled',
      title: 'Disabled state',
      content() {
        return (
          <p>
            <code>disabled</code> on <code>Context</code> disables the trigger and hidden input.{' '}
            <code>disabled</code> on an option skips it during navigation, typeahead and selection.
          </p>
        )
      },
    },
    {
      id: 'forms',
      title: 'Forms',
      content() {
        return (
          <p>
            Give <code>Context</code> a <code>name</code> and apply <code>hiddenInput()</code> to an
            input. It submits the selected value, with an empty string when no value is selected.
            Disabled selects are omitted from <code>FormData</code>.
          </p>
        )
      },
    },
    {
      id: 'events',
      title: 'Change events',
      content() {
        return (
          <p>
            <code>onSelectChange()</code> listens on the trigger or an ancestor. It receives the
            committed <code>value</code>, <code>label</code> and <code>optionId</code> after the
            popup closes and its label settles. Selecting the same value again does not dispatch a
            change.
          </p>
        )
      },
    },
    {
      id: 'feedback',
      title: 'Selection and close feedback',
      content() {
        return (
          <p>
            Options receive <code>data-select-flash</code> during selection. The popup’s CSS
            transition completes before the trigger label changes. <code>labelSwapDelayMs</code>{' '}
            adds a delay after closure. Motion preferences should be handled in the surface’s CSS.
          </p>
        )
      },
      code: [
        {
          source:
            "<select.Context defaultLabel=\"Choose delivery\" labelSwapDelayMs={0}>\n  <button mix={select.trigger()}><SelectedLabel /></button>\n  <popover.Context>\n    <div mix={[\n      css({\n        opacity: 0,\n        transition: 'opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',\n        '&:popover-open': { opacity: 1, '@starting-style': { opacity: 0 } },\n        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },\n      }),\n      select.popover(),\n    ]}>\n      {/* List and options */}\n    </div>\n  </popover.Context>\n</select.Context>",
        },
      ],
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      content() {
        return (
          <p>
            Give the trigger a field name and the list an accessible name. Click, ArrowDown and
            ArrowUp open the popup. Focus moves to the list while <code>aria-activedescendant</code>{' '}
            identifies the highlight. Enter or Space selects it. Escape and outside clicks close the
            popup and return focus to the trigger. Navigation follows Listbox behavior, including
            its current Tab interception.
          </p>
        )
      },
      code: [
        {
          source:
            '<button aria-label="Delivery method" type="button" mix={select.trigger()}>\n  <SelectedLabel />\n</button>\n<div aria-label="Delivery methods" mix={select.list()} />',
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
            {referenceTable(
              ['Option', 'Type', 'Behavior'],
              [
                ['defaultLabel', 'string', 'Required initial trigger text and fallback label.'],
                ['defaultValue', 'string | null', 'Initial selected value. Defaults to null.'],
                ['disabled', 'boolean', 'Defaults to false. Disables trigger and hidden input.'],
                ['name', 'string', 'Form field name used by hiddenInput().'],
                [
                  'labelSwapDelayMs',
                  'number',
                  'Additional label delay in milliseconds. Defaults to 75.',
                ],
                ['children', 'RemixNode', 'Trigger, popup and optional hidden input.'],
              ],
            )}
            <p>
              Descendants can read <code>displayedLabel</code>, <code>value</code>,{' '}
              <code>isOpen</code>, <code>isExpanded</code>, <code>disabled</code>, <code>name</code>
              , <code>listId</code>, <code>activeId</code> and <code>selectedId</code> from the
              provider context. <code>open()</code> and <code>close()</code> request popup changes.
              There is no exported context-value type.
            </p>
            <h3 id="trigger-reference">trigger()</h3>
            {referenceTable(
              ['Decoration', 'Values', 'Meaning'],
              [
                ['aria-haspopup', 'listbox', 'Popup semantics.'],
                ['aria-expanded', 'true | false', 'Popup expansion state.'],
                ['aria-controls', 'string', 'Generated list ID.'],
                ['aria-describedby', 'string | absent', 'Selected option ID.'],
                ['disabled', 'true | absent', 'Reflects Context disabled state or host disabled.'],
              ],
            )}
            <h3 id="popover-reference">popover()</h3>
            <p>
              Requires <code>popover.Context</code> from the Popover module. Positions the selected
              option over the trigger using inset relative alignment. The surface’s minimum width
              follows the trigger. Adds <code>popover=&quot;manual&quot;</code> through the Popover
              surface mixin.
            </p>
            <h3 id="list-reference">list()</h3>
            {referenceTable(
              ['Decoration', 'Values', 'Meaning'],
              [
                ['role', 'listbox', 'Supplied by Listbox.'],
                ['id', 'string', 'Generated list ID.'],
                ['tabIndex', '-1', 'Programmatic focus target.'],
                ['aria-activedescendant', 'string | absent', 'Highlighted option ID.'],
              ],
            )}
            <h3 id="option-reference">option(options)</h3>
            <p>
              Uses the Listbox option contract. <code>label</code> and <code>value</code> are
              required. <code>disabled</code> and <code>textValue</code> are optional.
            </p>
            {referenceTable(
              ['Decoration', 'Values', 'Meaning'],
              [
                ['role', 'option', 'Option semantics.'],
                ['id', 'string', 'Generated option ID.'],
                ['aria-selected, aria-disabled', 'true | false', 'Selected and disabled state.'],
                ['data-highlighted', 'true | false', 'Highlighted state.'],
                ['data-select-flash', 'true | absent', 'Temporary selection feedback.'],
              ],
            )}
            <h3 id="hidden-input-reference">hiddenInput()</h3>
            {referenceTable(
              ['Decoration', 'Values', 'Meaning'],
              [
                ['type', 'hidden', 'Native hidden input.'],
                ['name', 'string | absent', 'Context name.'],
                ['value', 'string', 'Selected value or empty string.'],
                ['disabled', 'true | absent', 'Context disabled state.'],
              ],
            )}
            <h3 id="change-listener-reference">onSelectChange(handler, captureBoolean?)</h3>
            <p>
              Listens for <code>rmx:select-change</code>. Receives the event and an abort signal.
              Capture defaults to false. Events bubble from the trigger, or from the surface when no
              trigger is registered.
            </p>
            <h3 id="change-event-reference">SelectChangeEvent</h3>
            {referenceTable(
              ['Property', 'Type', 'Meaning'],
              [
                ['value', 'string | null', 'Committed option value.'],
                ['label', 'string | null', 'Committed option label.'],
                ['optionId', 'string | null', 'Generated option ID.'],
              ],
            )}
            <h3 id="types-reference">Exported types</h3>
            {referenceTable(
              ['Type', 'Purpose'],
              [
                [
                  'SelectContextProps',
                  'Initial selection, label, timing, disabled state and form name.',
                ],
              ],
            )}
            <p>Option types belong to the Listbox module. Positioning types belong to Anchor.</p>
          </>
        )
      },
    },
  ],
} satisfies UiDocs
