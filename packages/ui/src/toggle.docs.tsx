import type { UiDocs } from './docs/types.ts'
import { referenceTable } from './docs/reference-table.tsx'

export default {
  title: 'Toggle',
  slug: 'toggle',
  category: 'primitives',
  description: 'A boolean switch with native input and custom host support.',
  importPath: '@remix-run/ui/toggle',
  examples: [
    {
      id: 'basic',
      title: 'Basic',
      description: '',
      previewSize: 'compact',
      module: new URL('./toggle/basic.example.tsx', import.meta.url),
    },
    {
      id: 'button-example',
      title: 'Button',
      description: '',
      section: 'hosts',
      previewSize: 'compact',
      module: new URL('./toggle/button.example.tsx', import.meta.url),
    },
    {
      id: 'controlled-example',
      title: 'Controlled',
      description: '',
      section: 'state',
      previewSize: 'compact',
      module: new URL('./toggle/controlled.example.tsx', import.meta.url),
    },
    {
      id: 'disabled-example',
      title: 'Disabled',
      description: '',
      section: 'availability',
      previewSize: 'compact',
      module: new URL('./toggle/disabled.example.tsx', import.meta.url),
    },
    {
      id: 'read-only-example',
      title: 'Read-only',
      description: '',
      section: 'availability',
      previewSize: 'compact',
      module: new URL('./toggle/read-only.example.tsx', import.meta.url),
    },
    {
      id: 'form-example',
      title: 'Form',
      description: '',
      section: 'forms',
      previewSize: 'compact',
      module: new URL('./toggle/form.example.tsx', import.meta.url),
    },
    {
      id: 'events-example',
      title: 'Events',
      description: '',
      section: 'events',
      previewSize: 'compact',
      module: new URL('./toggle/events.example.tsx', import.meta.url),
    },
  ],
  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy',
      content() {
        return (
          <p>
            Apply <code>toggle()</code> to a checkbox input or a custom switch element.
          </p>
        )
      },
      code: [
        {
          source:
            'import { toggle } from \'@remix-run/ui/toggle\'\n\n<label>\n  Email notifications\n  <input type="checkbox" mix={toggle({ defaultChecked: true })} />\n</label>',
        },
      ],
    },
    {
      id: 'hosts',
      title: 'Button switches',
      content() {
        return (
          <p>
            A button host receives switch semantics and keyboard handling. Native checkbox inputs
            also participate in forms. Custom hosts do not submit a value.
          </p>
        )
      },
    },
    {
      id: 'state',
      title: 'Controlled state',
      content() {
        return (
          <p>
            Pass <code>checked</code> and accept changes in <code>onCheckedChange</code> to manage
            state externally. <code>defaultChecked</code> only sets the initial state. Without
            either option, the switch starts off.
          </p>
        )
      },
    },
    {
      id: 'availability',
      title: 'Disabled and read-only',
      content() {
        return (
          <p>
            <code>disabled</code> blocks changes. <code>readOnly</code> also blocks changes while
            preserving focus and native form participation. These options can be passed to the mixin
            or placed on the host.
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
            Use a checkbox input with <code>name</code> and <code>value</code>. Checked inputs
            contribute their value to <code>FormData</code>. Unchecked and disabled inputs are
            omitted.
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
            <code>onToggleChange()</code> listens on the switch or an ancestor.{' '}
            <code>event.checked</code> contains the requested state. Controlled switches still need
            to accept that state through <code>checked</code>.
          </p>
        )
      },
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      content() {
        return (
          <p>
            Keep the accessible name stable when the switch changes. Space toggles both host types.
            Native button hosts also support Enter. <code>readOnly</code> controls remain focusable.
            On custom hosts, <code>disabled</code> sets <code>aria-disabled</code> but does not
            disable a native button automatically.
          </p>
        )
      },
      code: [
        {
          source:
            '<button\n  type="button"\n  disabled\n  aria-label="Security alerts"\n  mix={toggle({ disabled: true, defaultChecked: true })}\n/>',
        },
      ],
    },
    {
      id: 'api-reference',
      title: 'API reference',
      content() {
        return (
          <>
            <h3 id="toggle-reference">toggle(options)</h3>
            <p>
              Pass an options object, even when empty. Decorates the host with switch semantics and{' '}
              <code>data-state</code>. State can also be controlled by the host’s{' '}
              <code>checked</code> prop. The checked option takes precedence over the host checked
              prop. Disabled and read-only state can be set by either the options or the host.
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
                [
                  'required',
                  'boolean',
                  'Native input validation or aria-required on custom hosts.',
                ],
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
              Listens for <code>rmx:toggle-change</code>. The handler receives the event and an
              abort signal. <code>captureBoolean</code> defaults to false.
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
          </>
        )
      },
    },
  ],
} satisfies UiDocs
