import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { referenceTable } from '../reference-table.tsx'

export const meta = {
  title: 'Select',
  slug: 'select',
  category: 'primitives',
  description: 'Choose a single value from a button-triggered option list.',
  importPath: '@remix-run/ui/select',
} satisfies PageMeta

const basic = await loadExample('select/basic')
const richOptionsExample = await loadExample('select/rich-options')
const disabledExample = await loadExample('select/disabled')
const formExample = await loadExample('select/form')
const eventsExample = await loadExample('select/events')

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

const feedbackCode = await highlightSource(`
  <select.Context defaultLabel="Choose delivery" labelSwapDelayMs={0}>
    <button mix={select.trigger()}><SelectedLabel /></button>
    <popover.Context>
      <div mix={[
        css({
          opacity: 0,
          transition: 'opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',
          '&:popover-open': { opacity: 1, '@starting-style': { opacity: 0 } },
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }),
        select.popover(),
      ]}>
        {/* List and options */}
      </div>
    </popover.Context>
  </select.Context>
`)

const accessibilityCode = await highlightSource(`
  <button aria-label="Delivery method" type="button" mix={select.trigger()}>
    <SelectedLabel />
  </button>
  <div aria-label="Delivery methods" mix={select.list()} />
`)

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
      <Section id="disabled" title="Disabled state">
        <p>
          <code>disabled</code> on <code>Context</code> disables the trigger and hidden input.{' '}
          <code>disabled</code> on an option skips it during navigation, typeahead and selection.
        </p>
        <Example id="disabled-example" example={disabledExample} compact />
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
        <Example id="events-example" example={eventsExample} compact />
      </Section>
      <Section id="feedback" title="Selection and close feedback">
        <p>
          Options receive <code>data-select-flash</code> during selection. The popup’s CSS
          transition completes before the trigger label changes. <code>labelSwapDelayMs</code> adds
          a delay after closure. Motion preferences should be handled in the surface’s CSS.
        </p>
        <CodeBlock html={feedbackCode} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Give the trigger a field name and the list an accessible name. Click, ArrowDown and
          ArrowUp open the popup. Focus moves to the list while <code>aria-activedescendant</code>{' '}
          identifies the highlight. Enter or Space selects it. Escape and outside clicks close the
          popup and return focus to the trigger. Navigation follows Listbox behavior, including its
          current Tab interception.
        </p>
        <CodeBlock html={accessibilityCode} />
      </Section>
      <Section id="api-reference" title="API reference">
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
          Descendants can read <code>displayedLabel</code>, <code>value</code>, <code>isOpen</code>,{' '}
          <code>isExpanded</code>, <code>disabled</code>, <code>name</code>, <code>listId</code>,{' '}
          <code>activeId</code> and <code>selectedId</code> from the provider context.{' '}
          <code>open()</code> and <code>close()</code> request popup changes. There is no exported
          context-value type.
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
          Uses the Listbox option contract. <code>label</code> and <code>value</code> are required.{' '}
          <code>disabled</code> and <code>textValue</code> are optional.
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
      </Section>
    </PageLayout>
  )
}
