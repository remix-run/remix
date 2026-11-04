# Form

Native form validation with application-owned markup. Define one schema with [`remix/data-schema/form`](https://github.com/remix-run/remix/blob/main/packages/data-schema/src/form/README.md), then use `Context` and role mixins to connect controls, labels, and errors.

```tsx
import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'
import { email, minLength } from 'remix/data-schema/checks'
import * as form from '@remix-run/ui/form'
import type { FieldBinding } from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import type { Handle } from 'remix/component'

export const Signup = fd.object({
  email: fd.text(s.string().pipe(email())),
  password: fd.password(s.string().pipe(minLength(8))),
})

function SignupForm(handle: Handle<{ submission?: FormSubmission }>) {
  return () => (
    <form.Context id={handle.id} schema={Signup} submission={handle.props.submission}>
      {({ fields, errors }) => (
        <form method="post" mix={form.root()}>
          {errors.form && <p role="alert">{errors.form.join(' ')}</p>}
          <label mix={form.label(fields.email)}>Email</label>
          <input type="email" autoComplete="email" mix={form.control(fields.email)} />
          {fields.email.errors.length > 0 && (
            <p role="alert" mix={form.error(fields.email)}>
              {fields.email.errors.join(' ')}
            </p>
          )}
          <PasswordField field={fields.password} />
          <button type="submit">Sign up</button>
        </form>
      )}
    </form.Context>
  )
}

function PasswordField(handle: Handle<{ field: FieldBinding<'password'> }>) {
  return () => {
    let field = handle.props.field
    return (
      <>
        <label mix={form.label(field)}>Password</label>
        <input autoComplete="new-password" mix={form.control(field)} />
        {field.errors.length > 0 && (
          <p role="alert" mix={form.error(field)}>
            {field.errors.join(' ')}
          </p>
        )}
      </>
    )
  }
}
```

## Parse submissions

```tsx
let submission = fd.parseSafe(Signup, await request.formData())
if (!submission.success) {
  return render(<SignupForm submission={submission} />, { status: 400 })
}
await createAccount(submission.value)
```

Pass failed `fd.parseSafe` results directly to Context to restore values and show errors. Sensitive fields and files are never restored; successful parsing still returns their validated values. Handlers can also construct a `FormSubmission` for business failures. See [form schemas](https://github.com/remix-run/remix/blob/main/packages/data-schema/src/form/README.md) for parsing and sensitivity options.

## Context and role mixins

`Context` owns one form instance and supplies stable typed `fields` and current grouped errors. Its render prop always receives `errors`; `errors.form` is absent when there are no form-level messages. Changing the schema requires a new keyed Context.

- `root()` coordinates native invalid feedback for unmanaged controls. It leaves valid submissions to the browser and application.
- `control(field)` provides constraints, restored defaults, native validity, touched state, and ARIA. It defaults the input type from the decoding kind; compatible authored types override it. Text entries also support single-select and textarea. Repeated text entries support multiple selects and checkbox groups.
- `label(field, value?)` supplies `htmlFor`; pass the option value for a radio or grouped checkbox label. `error(field)` supplies an error ID. Content, visibility, roles, and styling remain in JSX.

Bindings belong to their Context and cannot be shared between form instances. Pass a client entry's `handle.id` as Context's `id` to preserve IDs during hydration, and use unique scopes for multiple forms. Authored props win; custom control IDs need matching labels. Existing help-text IDs in `aria-describedby` are retained.

Use `getConstraints(schema, { type, multiple? })` for custom integrations. It projects supported native attributes: `required`, `minLength`, `maxLength`, `min`, `max`, and numeric `step="any"`. Author date/time bounds and steps in markup. Hidden and action controls receive no constraints; range, color, and grouped checkboxes do not receive `required`. Schema validation enforces additional rules.

## Native control types

Choose the descriptor for the submitted value, then set presentation types in markup:

| Descriptor                             | Native controls                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `fd.text(schema)`                      | text, email, url, search, tel, date, month, week, time, datetime-local, color, hidden, radio, select, textarea |
| `fd.password(schema)`                  | password                                                                                                       |
| `fd.number(schema)`                    | number, range                                                                                                  |
| `fd.checkbox(schema?)`                 | checkbox                                                                                                       |
| `fd.fields(schema)`                    | multiple select or a group of string-valued checkboxes                                                         |
| `fd.file(schema)` / `fd.files(schema)` | file; `files` supplies `multiple`                                                                              |

Date/time and color values stay strings; range values become numbers. Author buttons and submit/reset/image inputs normally. If an action input needs a text binding, `control(field)` supplies its ID, name, and type without validation or restoration. Hidden inputs retain server validation and failed values but cannot block browser submission.

The following variants use `fields` inside the Context render callback shown above. Radio options share one text binding and submitted name; use a fieldset and legend for the group:

```tsx
let Preferences = fd.object({ delivery: fd.text(s.enum_(['email', 'sms'])) })

<fieldset>
  <legend>Delivery method</legend>
  <input type="radio" value="email" mix={form.control(fields.delivery)} />
  <label mix={form.label(fields.delivery, 'email')}>Email</label>
  <input type="radio" value="sms" mix={form.control(fields.delivery)} />
  <label mix={form.label(fields.delivery, 'sms')}>SMS</label>
</fieldset>
```

Pass the option value to `label` for distinct associations. The group shares feedback and restores its selected option from a failed submission.

File controls validate selected files. Set `encType="multipart/form-data"` on the enclosing form:

```tsx
let Upload = fd.object({
  avatar: fd.file(s.optional(s.instanceof_(Blob))),
  attachments: fd.files(s.array(s.instanceof_(Blob))),
})

<>
  <label mix={form.label(fields.avatar)}>Avatar</label>
  <input accept="image/*" mix={form.control(fields.avatar)} />
  <label mix={form.label(fields.attachments)}>Attachments</label>
  <input mix={form.control(fields.attachments)} />
</>
```

No selection becomes `undefined` for a single file or `[]` for multiple files. A failed submission clears live file selections; ordinary rerenders preserve them. `accept` is a browser hint; validate files and store uploads in the handler.

## Multiple values

Use `fd.fields` for one multiple select or one same-name checkbox group. The schema validates an array of selected strings; no selection is `[]`, and blank strings remain strings.

```tsx
let Preferences = fd.object({
  topics: fd.fields(
    s.array(s.string()).refine((values) => values.length > 0, 'Choose a topic'),
  ),
})

<>
  <label mix={form.label(fields.topics)}>Topics</label>
  <select mix={form.control(fields.topics)}>
    <option value="typescript">TypeScript</option>
    <option value="css">CSS</option>
  </select>
</>
```

The select mixin supplies `multiple`. Alternatively, render a checkbox group using the same binding:

```tsx
<fieldset>
  <legend>Topics</legend>
  <input type="checkbox" value="typescript" mix={form.control(fields.topics)} />
  <label mix={form.label(fields.topics, 'typescript')}>TypeScript</label>
  <input type="checkbox" value="css" mix={form.control(fields.topics)} />
  <label mix={form.label(fields.topics, 'css')}>CSS</label>
</fieldset>
```

Options share errors and touched state; disabled options are excluded from validation. Failed arrays restore selected or checked defaults. Author initial selections with array `defaultValue` on a multiple select or `defaultChecked` on each checkbox; native reset returns to those defaults.

Native select requiredness can enforce at least one selection. Checkbox-group rules and more specific collection checks run in JavaScript and in the handler; without JavaScript, the server enforces them. Repeated free-text inputs and indexed field arrays still need application-owned UI handling.

## Live state and component props

Pass `FieldBinding<'text'>`, `FieldBinding<'password'>`, or another supported kind through ordinary props. Read `field.errors`, `field.touched`, and `handle.props` during rendering. Setup-time destructuring captures a snapshot. Context updates rerender child fields even when binding identity is unchanged; no subscriptions or update callbacks are needed.

Client errors appear after blur or blocked submission, then update while editing. Server errors appear immediately; editing replaces them with current client feedback. A non-canceled native reset clears touched state and custom errors after native defaults restore. Programmatic edits need an `input` or `change` event.

Single-select controls render restored values as selected options on the server and update their native reset defaults when a new submission arrives. Use `defaultValue` for an authored initial selection; per-option `selected` flags are unnecessary.

A new submission object refreshes feedback and restored values. Reuse its identity until another submission arrives so unrelated renders preserve user edits. Applications own fetching, navigation, and pending state.

## Shared messages and supplemental errors

Configure `errorMap` on an `fd.text`, `fd.password`, `fd.number`, or `fd.checkbox` descriptor. It customizes schema messages and supported native messages using domain codes such as `value.required`, `type.number`, `string.email`, `string.url`, `string.min_length`, `string.max_length`, `number.min`, and `number.max`. Explicit refinement messages retain precedence; refinements without messages use `refine.failed`. Native-only pattern and step failures keep browser wording.

`field.setCustomErrors(['Already in use'])` adds supplemental errors for the current control value without replacing native/schema errors or marking the field touched. Errors block native submission immediately. They survive same-value revalidation and clear on changed value, non-canceled reset, or a new submission. Applications own async requests, debouncing, cancellation, stale-result checks, and server enforcement.

`InputValidationEvent` and `onInputValidation(handler)` expose bubbling feedback notifications for integrations. Context handles its own updates.

## Without JavaScript

SSR provides native constraints, values, labels, errors, and accessibility associations. Native validation and server validation remain correct without JavaScript. JavaScript adds schema validation before submission and interactive feedback; no-JavaScript timing and tooltips follow browser behavior.
