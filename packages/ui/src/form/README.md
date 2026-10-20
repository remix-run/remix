# form

Define schema-backed fields, parse submissions on the server, and bind native controls with progressive browser feedback. Applications own markup, styles, and error UI.

## Usage

Install with `npm i remix @remix-run/ui`. Create the definition once and bind it per component instance:

```tsx
import * as s from 'remix/data-schema'
import { email } from 'remix/data-schema/checks'
import type { FormSubmission } from '@remix-run/ui/form'
import type { Handle } from 'remix/component'
import { createField, createForm, createFormMixins } from '@remix-run/ui/form'

let Email = createField({
  schema: s.string().pipe(email()),
  label: 'Email',
  type: 'email',
})
let Signup = createForm({ fields: { email: Email } })

function SignupPage(handle: Handle<{ submission?: FormSubmission }>) {
  let { form, field, label, error, fields } = createFormMixins(Signup, {
    getSubmission: () => handle.props.submission,
    onChange: () => handle.update(),
  })

  return () => (
    <form method="post" mix={form()}>
      <label mix={label('email')}>{Signup.fields.email.label}</label>
      <input autoComplete="email" mix={field('email')} />
      {fields.email.errors.length > 0 ? (
        <p mix={error('email')} role="alert">
          {fields.email.errors.join(' ')}
        </p>
      ) : null}
      <button type="submit">Create account</button>
    </form>
  )
}
```

Mount or hydrate the component through your app's [client-entry setup](https://github.com/remix-run/remix/blob/main/packages/component/README.md#client-entry-loading) to enable browser behavior.

## Form definitions

`createForm({ schema?, fields })` selects model fields or supplies inline schemas. All variations use the same parsing and mixin APIs.

```ts
let Account = s.object({ id: s.string(), email: s.string().pipe(email()) })
let Address = s.object({ postalCode: s.string() })

// Single schema: select fields without repeating their validation rules.
let Profile = createForm({
  schema: Account,
  fields: { email: { label: 'Email', type: 'email' } },
})

// Partial inline: add request-only fields alongside model fields.
let Registration = createForm({
  schema: Account,
  fields: {
    email: { label: 'Email', type: 'email' },
    terms: { label: 'Accept terms', type: 'checkbox', schema: s.literal(true) },
  },
})

// Multiple schemas: compose existing field rules into one operation.
let Checkout = createForm({
  schema: s.object({ email: Account.shape.email, postalCode: Address.shape.postalCode }),
  fields: {
    email: { label: 'Email', type: 'email' },
    postalCode: { label: 'Postal code', type: 'text' },
  },
})

// Entirely inline: every field supplies its own schema.
let Search = createForm({
  fields: { query: { label: 'Search', type: 'text', schema: s.string() } },
})
```

Model-backed fields cannot override their schemas; fields absent from the model must supply one. `Form.fields` contains resolved definitions, including `label` and schema-derived `required`. Logical field names key parsed values and errors; optional `name` and `id` settings change HTML attributes without changing those keys.

### Server parsing

Definitions and parsing are server-safe and do not require a DOM:

```tsx
let submission = Registration.parse(await request.formData())

if (!submission.success) {
  return render(<RegistrationPage submission={submission} />, { status: 400 })
}

let { email } = submission.value
await createAccount({ id: crypto.randomUUID(), email })
```

Parsing runs only the configured field schemas. The backing schema must expose `.shape`; an object-level `.refine()` returns a general schema that cannot be passed directly. Run cross-field/business checks separately, then supply generated values and select fields for persistence. A form spanning multiple tables still parses once.

Empty text and number values decode to `undefined`, numbers use `Number()`, and checkboxes decode to booleans. Use `optional()` or `defaulted()` in the field schema to accept empty values.

Results are `{ success: true, value }` or `{ success: false, issues, values, errors }`. Failures retain raw values and group messages in `errors.fields` and `errors.form`; password values are omitted.

### Native constraints and low-level helpers

`getConstraints(schema, { type })` derives `required`, `minLength`, `maxLength`, `min`, and `max` from schema metadata and input context. Number inputs also receive `step="any"`. Arbitrary refinements, patterns, and numeric increments are not converted to attributes.

Definitions expose `getInputAttrs()`, `getLabelAttrs()`, `getErrorAttrs()`, `getFieldErrors()`, and `createInputValidator()` for custom integrations. Prefer the mixins for automatic SSR attributes, feedback, and accessibility.

## A standalone field

For a single control, bind `Email` directly in component setup:

```tsx
import { createFieldMixins } from '@remix-run/ui/form'

let emailField = createFieldMixins(Email, {
  name: 'email',
  getSubmission: () => handle.props.submission,
  onChange: () => handle.update(),
})

// Use emailField.field(), emailField.label(), and emailField.error() in markup.
// Read emailField.errors and emailField.touched during rendering.
```

Independent bindings can share an ordinary `<form>` without a form mixin. Native submission collects their values and checks validity. Parse each definition with `Email.parse(formData, 'email')`, combining failures in the handler, or compose them into `createForm()` for combined parsing.

## `createFormMixins(formDefinition, { getSubmission, onChange }?)`

The factories provide `form()` for unmanaged controls, `field(name)` for a configured control, `label(name)` for its label association, and `error(name)` for its error-element id. `input(name)` aliases `field(name)`; `errors.name` aliases `fields.name.errors`.

`getSubmission` reads current server state during rendering or state access, including SSR. It is not a subscription: update props or request a render after changing a local submission. Return the same submission object until a new submission arrives; a new object resets feedback without firing `onChange`.

## Live field state

Standalone bindings expose these properties directly; form bindings expose them through `fields.name`:

- `errors`: visible client messages or server errors; empty for pristine client fields
- `touched`: revealed by blur, a native invalid event, or editing a server error; stays true until reset or a new submission

Server errors are visible immediately, even while `touched` is false. State objects are stable and properties are read-only: read them during rendering, since destructuring a boolean or array in setup captures a snapshot. `onChange` requests a render when errors or touched state change. Without it, native validity and ARIA still update, but error markup needs another render trigger.

A non-canceled native form reset clears touched state and displayed errors. Programmatic value changes require an `input` or `change` event to refresh validation.

## Shared error messages

Configure `errorMap` on `createField()` or a `createForm({ fields })` entry. It customizes schema failures during parsing and supported native failures in the browser. Return a string to replace a message or `undefined` to keep the default.

```ts
import * as s from 'remix/data-schema'
import { email } from 'remix/data-schema/checks'
import { createField } from '@remix-run/ui/form'

let Email = createField({
  schema: s
    .string()
    .pipe(email())
    .refine((value) => value.endsWith('@example.com')),
  label: 'Email',
  type: 'email',
  errorMap({ code }) {
    if (code === 'value.required') return 'Enter your email'
    if (code === 'string.email') return 'Use a valid email address'
    if (code === 'refine.failed') return 'Use your example.com email'
  },
})
```

Explicit refinement messages bypass the map: `.refine(predicate, 'Specific message')` keeps that message. Omit it to map `refine.failed`, as above. Uncoded checks also bypass mapping; coded checks use the normal schema `errorMap` behavior.

The native adapter uses this priority when multiple flags fail:

| Native failure                             | Domain code                   | `values`  |
| ------------------------------------------ | ----------------------------- | --------- |
| Missing required value                     | `value.required`              | —         |
| Unparseable number                         | `type.number`                 | —         |
| Email or URL type mismatch                 | `string.email` / `string.url` | —         |
| Pattern mismatch                           | Browser fallback              | —         |
| Too long                                   | `string.max_length`           | `{ max }` |
| Too short                                  | `string.min_length`           | `{ min }` |
| Numeric range underflow                    | `number.min`                  | `{ min }` |
| Numeric range overflow                     | `number.max`                  | `{ max }` |
| Step mismatch or other native-only failure | Browser fallback              | —         |

Only the first failure is mapped. If it has no mapping or the callback returns `undefined`, browser wording remains. Schema validation runs only after native checks pass. The map receives decoded `input`, a logical field `path`, and any constraint `values`. Resolved messages drive tooltips and inline feedback without revealing pristine fields.

`value.required` normalizes required empty-value failures; other mapped codes come from data-schema. Authored `pattern` and `step` constraints keep browser wording. Message overrides add no server rules; include `email()` in the schema to validate email format. Without JavaScript, native tooltips remain unchanged.

## `setCustomErrors(messages)`

Call `fields.username.setCustomErrors(messages)` or a standalone binding's `setCustomErrors(messages)` to replace supplemental messages. Pass `[]` to clear them. Arrays are copied, empty strings ignored, and messages are not passed through `errorMap`.

For mounted controls, messages synchronously update native validity and accessibility without marking the field touched. They block native submission but follow normal feedback visibility. Native/schema errors remain primary, with custom messages appended. Existing server errors remain visible until editing.

Messages belong to the current value, including checkbox state. They survive revalidation and same-value checks, but clear on a changed value, non-canceled reset, or new submission. Before mounting, they attach to the first mounted value.

### Custom async validation

An availability check can use ordinary event mixins. In component setup, bind a form definition that includes a `username` field:

```tsx
import { on } from 'remix/component'
import { createFormMixins } from '@remix-run/ui/form'

// In component setup; SignupForm includes a username field.
let { form, field, label, error, fields } = createFormMixins(SignupForm, {
  getSubmission: () => handle.props.submission,
  onChange: () => handle.update(),
})
let resetVersion = 0

return () => (
  <form
    method="post"
    mix={[
      form(),
      on('reset', () => {
        resetVersion++
      }),
    ]}
  >
    <label mix={label('username')}>Username</label>
    <input
      autoComplete="username"
      mix={[
        field('username'),
        on('input', async (event, signal) => {
          let control = event.currentTarget
          let username = control.value
          let submission = handle.props.submission
          let version = resetVersion
          let isCurrent = () =>
            !signal.aborted &&
            control.value === username &&
            handle.props.submission === submission &&
            resetVersion === version

          if (!username) return

          try {
            let response = await fetch(
              `/username-available?username=${encodeURIComponent(username)}`,
              { signal },
            )
            if (!response.ok) throw new Error('Availability check failed')
            let available: unknown = await response.json()
            if (typeof available !== 'boolean') throw new Error('Invalid availability response')
            if (!isCurrent()) return

            fields.username.setCustomErrors(
              available ? [] : ['This username is already registered'],
            )
          } catch (error) {
            if (isCurrent()) console.error('Could not check username availability', error)
          }
        }),
      ]}
    />
    {fields.username.errors.length > 0 ? (
      <p mix={error('username')} role="alert">
        {fields.username.errors.join(' ')}
      </p>
    ) : null}
    <button type="submit">Register</button>
  </form>
)
```

The endpoint returns a JSON boolean. `on()` aborts the signal on the next input event or control removal; the extra guards reject stale results even if cancellation is ignored. Existing errors survive same-value rechecks until replaced.

Applications own debouncing, caching, pending indicators, and request-failure UI. A failed lookup is not an invalid username. Pending work does not delay submission: repeat business checks and enforce uniqueness on the server. Without JavaScript, validation happens on submission.

## Control behavior

Each `field()` mixin:

- applies generated ids, names, types, native constraints, restored values, and server error attributes during SSR
- validates initially and on `input`, `change`, and blur using native constraints first and synchronous schema validation through `setCustomValidity()` when native constraints pass
- reveals errors after the first blur or native `invalid` event, and updates feedback as the user types
- preserves server errors until the field is edited, then replaces them with current client feedback
- sets `data-touched`, `aria-invalid`, and error-description linkage, preserving other `aria-describedby` ids
- preserves explicit host props, so authored attributes such as `autoComplete`, `aria-invalid`, or an intentional `type` override win

Apply it to every configured control, even when all its constraints are native.

Use `type: 'text'` for string-valued select/textarea definitions; the mixin omits the input-only `type` attribute on these elements. Single-value native selects are supported. Applications own option markup, including `selected` attributes when restoring a server-rendered selection. Multi-select arrays and radio groups are not modeled by this scalar field API.

## `label(field)`

Associates a `<label>` with the field's configured id during SSR and client rendering. Standalone bindings use `label()`. Applications own text, required markers, and styles. Explicit `htmlFor` overrides the association; configure the field's `id` to change both label and control together. This is not a legend or radio-group binding.

## `error(field)`

Applies the error-element id during SSR and client rendering. It does not choose content, visibility, styles, or announcement roles. Explicit host props win; keep the generated id to preserve automatic error linkage.

## `onInputValidation(handler)`

Observe bubbling `rmx:input-validation` events on a control or ancestor. Events snapshot the logical `field`, `errorId`, visible `errors`, and `touched` state. Prefer live field state and `onChange` for ordinary rendering; observing does not disable default behavior.

## `form()`

The standalone export and the form-binding method enhance unmanaged inputs, selects, and textareas. They synchronize touched/ARIA state after blur or a native invalid event and clear stale server-error linkage after editing. Managed controls are skipped to avoid duplicate handling.

Without JavaScript, native constraints still prevent invalid submissions and server-rendered errors remain accessible. Do not add `noValidate` unless the application intentionally opts out of native constraint validation.
