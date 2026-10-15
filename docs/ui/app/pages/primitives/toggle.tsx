import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { referenceTable } from '../reference-table.tsx'

export const meta = {
  title: 'Toggle',
  slug: 'toggle',
  category: 'primitives',
  description: 'A boolean switch with native input and custom host support.',
  importPath: '@remix-run/ui/toggle',
} satisfies PageMeta

const basic = await loadExample('toggle/basic')
const buttonExample = await loadExample('toggle/button')
const controlledExample = await loadExample('toggle/controlled')
const disabledExample = await loadExample('toggle/disabled')
const readOnlyExample = await loadExample('toggle/read-only')
const formExample = await loadExample('toggle/form')
const eventsExample = await loadExample('toggle/events')

const anatomyCode = await highlightSource(`
  import { toggle } from '@remix-run/ui/toggle'

  <label>
    Email notifications
    <input type="checkbox" mix={toggle({ defaultChecked: true })} />
  </label>
`)

const accessibilityCode = await highlightSource(`
  <button
    type="button"
    disabled
    aria-label="Security alerts"
    mix={toggle({ disabled: true, defaultChecked: true })}
  />
`)

export default function TogglePage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero compact />
      <Section id="anatomy" title="Anatomy">
        <p>
          Apply <code>toggle()</code> to a checkbox input or a custom switch element.
        </p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="hosts" title="Button switches">
        <p>
          A button host receives switch semantics and keyboard handling. Native checkbox inputs also
          participate in forms. Custom hosts do not submit a value.
        </p>
        <Example id="button-example" example={buttonExample} compact />
      </Section>
      <Section id="state" title="Controlled state">
        <p>
          Pass <code>checked</code> and accept changes in <code>onCheckedChange</code> to manage
          state externally. <code>defaultChecked</code> only sets the initial state. Without either
          option, the switch starts off.
        </p>
        <Example id="controlled-example" example={controlledExample} compact />
      </Section>
      <Section id="availability" title="Disabled and read-only">
        <p>
          <code>disabled</code> blocks changes. <code>readOnly</code> also blocks changes while
          preserving focus and native form participation. These options can be passed to the mixin
          or placed on the host.
        </p>
        <Example id="disabled-example" example={disabledExample} compact title="Disabled" />
        <Example id="read-only-example" example={readOnlyExample} compact title="Read-only" />
      </Section>
      <Section id="forms" title="Forms">
        <p>
          Use a checkbox input with <code>name</code> and <code>value</code>. Checked inputs
          contribute their value to <code>FormData</code>. Unchecked and disabled inputs are
          omitted.
        </p>
        <Example id="form-example" example={formExample} compact />
      </Section>
      <Section id="events" title="Change events">
        <p>
          <code>onToggleChange()</code> listens on the switch or an ancestor.{' '}
          <code>event.checked</code> contains the requested state. Controlled switches still need to
          accept that state through <code>checked</code>.
        </p>
        <Example id="events-example" example={eventsExample} compact />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Keep the accessible name stable when the switch changes. Space toggles both host types.
          Native button hosts also support Enter. <code>readOnly</code> controls remain focusable.
          On custom hosts, <code>disabled</code> sets <code>aria-disabled</code> but does not
          disable a native button automatically.
        </p>
        <CodeBlock html={accessibilityCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="toggle-reference">toggle(options)</h3>
        <p>
          Pass an options object, even when empty. Decorates the host with switch semantics and{' '}
          <code>data-state</code>. State can also be controlled by the host’s <code>checked</code>{' '}
          prop. The checked option takes precedence over the host checked prop. Disabled and
          read-only state can be set by either the options or the host.
        </p>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            ['checked', 'boolean', 'Controlled state. Omit to let the mixin manage state.'],
            ['defaultChecked', 'boolean', 'Initial uncontrolled state. Defaults to false.'],
            [
              'onCheckedChange',
              '(checked: boolean) => void',
              'Called with the requested state before the bubbling event.',
            ],
            [
              'disabled',
              'boolean',
              'Prevents changes. Native inputs receive disabled. Custom hosts receive aria-disabled.',
            ],
            [
              'readOnly',
              'boolean',
              'Prevents changes. Native inputs receive readOnly. Custom hosts receive aria-readonly.',
            ],
            ['name', 'string', 'Native input form field name.'],
            [
              'value',
              'string',
              'Native input submitted value. Without a value, the browser uses on.',
            ],
            ['form', 'string', 'ID of the native input’s form owner.'],
            ['required', 'boolean', 'Native input validation or aria-required on custom hosts.'],
            [
              'tabIndex',
              'number',
              'Native input override. Custom hosts default to 0 when enabled.',
            ],
            [
              'inputRef',
              '(input: HTMLInputElement, signal: AbortSignal) => void',
              'Receives a native input and its lifetime signal. Not called for custom hosts.',
            ],
          ],
        )}
        {referenceTable(
          ['Decoration', 'Values', 'Meaning'],
          [
            ['role', 'switch', 'Applied to both host types.'],
            ['data-state', 'checked | unchecked', 'Reflects the current checked state.'],
            [
              'aria-checked',
              'boolean',
              'Custom hosts only. Native inputs use their checked property.',
            ],
            [
              'aria-disabled, aria-readonly, aria-required',
              'true | absent',
              'Custom hosts only. Reflect the corresponding options.',
            ],
          ],
        )}
        <h3 id="change-listener-reference">onToggleChange(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:toggle-change</code>. The handler receives the event and an abort
          signal. <code>captureBoolean</code> defaults to false.
        </p>
        <h3 id="change-event-reference">ToggleChangeEvent</h3>
        {referenceTable(
          ['Property', 'Type', 'Meaning'],
          [['checked', 'boolean', 'Requested state. The event bubbles from the switch host.']],
        )}
        <h3 id="types-reference">Exported types</h3>
        {referenceTable(
          ['Type', 'Purpose'],
          [['ToggleOptions', 'State, form and host options accepted by toggle().']],
        )}
      </Section>
    </PageLayout>
  )
}
