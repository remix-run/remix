import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Toggle',
  slug: 'toggle',
  category: 'patterns',
  description: 'A boolean switch with native input and custom host support.',
  importPath: '@remix-run/ui/toggle',
} satisfies PageMeta

const basic = await loadExample('toggle/basic')
const buttonExample = await loadExample('toggle/button')
const controlledExample = await loadExample('toggle/controlled')
const disabledExample = await loadExample('toggle/disabled')
const readOnlyExample = await loadExample('toggle/read-only')
const formExample = await loadExample('toggle/form')

const anatomyCode = await highlightSource(`
  import { toggle } from '@remix-run/ui/toggle'
  import { css } from 'remix/component'

  <label>
    Switch label
    <input type="checkbox" mix={[
      toggle(),
      css({
        '&[data-state="checked"]': {},
        '&[data-state="unchecked"]': {},
        '&:focus-visible': {},
        '&:disabled': {},
        '&[readonly]': {},
        '&:required': {},
      }),
    ]} />
  </label>
`)

const customHostAnatomyCode = await highlightSource(`
  <button
    type="button"
    mix={[
      toggle(),
      css({
        '&[data-state="checked"]': {},
        '&[data-state="unchecked"]': {},
        '&[aria-disabled]': {},
        '&[aria-readonly]': {},
        '&[aria-required]': {},
        '&:focus-visible': {},
      }),
    ]}
  >
    Switch label
  </button>
`)

const eventsCode = await highlightSource(`
  import { onToggleChange } from '@remix-run/ui/toggle'

  <div mix={onToggleChange((event) => {
    savePreference(event.checked)
  })}>
    {/* Switch */}
  </div>
`)

const accessibilityCode = await highlightSource(`
  <button
    type="button"
    disabled
    aria-label="Security alerts"
    mix={toggle({
      disabled: true,
      defaultChecked: true,
    })}
  />
`)

const typeDefinitions = {
  ToggleOptions: await highlightSource(
    `export interface ToggleOptions {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  form?: string
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  name?: string
  onCheckedChange?: (checked: boolean) => void
  readOnly?: boolean
  required?: boolean
  tabIndex?: number
  value?: string
}`,
  ),
}

export default function TogglePage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
        <CodeBlock html={customHostAnatomyCode} />
      </Section>
      <Section id="hosts" title="Button switches">
        <p>
          A button host receives switch semantics and keyboard handling. Native checkbox inputs also
          participate in forms. Custom hosts do not submit a value. A button can also use its native{' '}
          <code>disabled</code> attribute.
        </p>
        <Example id="button-example" example={buttonExample} />
      </Section>
      <Section id="state" title="Controlled state">
        <p>
          Pass <code>checked</code> and update it in <code>onCheckedChange</code> to control the
          switch. Without <code>checked</code>, the mixin manages state, starting from{' '}
          <code>defaultChecked</code> or false.
        </p>
        <Example id="controlled-example" example={controlledExample} />
      </Section>
      <Section id="forms" title="Forms">
        <p>
          Use a checkbox input with <code>name</code> and <code>value</code>. Checked inputs
          contribute their value to <code>FormData</code>. Unchecked and disabled inputs are
          omitted.
        </p>
        <Example id="form-example" example={formExample} />
      </Section>
      <Section id="events" title="Change events">
        <p>
          <code>onToggleChange()</code> listens on the switch or an ancestor.{' '}
          <code>event.checked</code> contains the requested state. Controlled switches still need to
          accept that state through <code>checked</code>.
        </p>
        <CodeBlock html={eventsCode} />
      </Section>
      <Section id="availability" title="Disabled and read-only">
        <p>
          <code>disabled</code> blocks changes and excludes native inputs from forms.{' '}
          <code>readOnly</code> blocks changes while preserving focus and native form participation.
          Set these options on the mixin or host.
        </p>
        <Example id="disabled-example" example={disabledExample} title="Disabled" />
        <Example id="read-only-example" example={readOnlyExample} title="Read-only" />
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
        <h3 id="toggle-reference">toggle(options?)</h3>
        <p>
          Adds switch semantics and <code>data-state</code> to the host. State can also be
          controlled by the host’s <code>checked</code> prop. The checked option takes precedence
          over the host checked prop. Disabled and read-only state can be set by either the options
          or the host. Host <code>defaultChecked</code> is also supported, with the mixin option
          taking precedence.
        </p>
        <ApiTable id="toggle-options" label="Option" defaults>
          <ApiEntry name="checked" type="boolean">
            Controlled state. Omit to let the mixin manage state.
          </ApiEntry>
          <ApiEntry name="defaultChecked" type="boolean" defaultValue="false">
            Initial uncontrolled state.
          </ApiEntry>
          <ApiEntry name="onCheckedChange" type="(checked: boolean) => void">
            Called with the requested state before the bubbling event.
          </ApiEntry>
          <ApiEntry name="disabled" type="boolean">
            Prevents changes. Native inputs receive disabled. Custom hosts receive aria-disabled.
          </ApiEntry>
          <ApiEntry name="readOnly" type="boolean">
            Prevents changes. Native inputs receive readOnly. Custom hosts receive aria-readonly.
          </ApiEntry>
          <ApiEntry name="name" type="string">
            Native input form field name.
          </ApiEntry>
          <ApiEntry name="value" type="string">
            Native input submitted value. Without a value, the browser uses on.
          </ApiEntry>
          <ApiEntry name="form" type="string">
            ID of the native input’s form owner.
          </ApiEntry>
          <ApiEntry name="required" type="boolean">
            Native input validation or aria-required on custom hosts.
          </ApiEntry>
          <ApiEntry name="tabIndex" type="number">
            Overrides the host tabIndex on either host type. Custom hosts default to 0 when enabled.
          </ApiEntry>
          <ApiEntry name="inputRef" type="(input: HTMLInputElement, signal: AbortSignal) => void">
            Receives a native input and its lifetime signal. Not called for custom hosts.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="toggle-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="role" type="switch">
            Applied to both host types.
          </ApiEntry>
          <ApiEntry name="data-state" type="checked | unchecked">
            Reflects the current checked state.
          </ApiEntry>
          <ApiEntry name="aria-checked" type="boolean">
            Custom hosts only. Native inputs use their checked property.
          </ApiEntry>
          <ApiEntry name="aria-disabled, aria-readonly, aria-required" type="true | absent">
            Custom hosts only. Reflect the corresponding options.
          </ApiEntry>
        </ApiTable>
        <h3 id="change-listener-reference">onToggleChange(handler, captureBoolean?)</h3>
        <p>
          Listens for <code>rmx:toggle-change</code>. The handler receives the event and an abort
          signal. <code>captureBoolean</code> defaults to false.
        </p>
        <h3 id="change-event-reference">ToggleChangeEvent</h3>
        <ApiTable id="change-event-properties" label="Property">
          <ApiEntry name="checked" type="boolean">
            Requested state. The event bubbles from the switch host.
          </ApiEntry>
        </ApiTable>
        <p>
          Construct with <code>new ToggleChangeEvent(checked)</code>. The event is not cancelable.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-ToggleOptions" name="ToggleOptions" type="interface">
            <p>State, form and host options accepted by toggle().</p>
            <CodeBlock html={typeDefinitions.ToggleOptions} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
