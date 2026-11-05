# Form

**Experimental:** APIs and behavior in this module may change or be removed in patch releases.

Native form validation with application-owned markup. Define a schema with [`remix/data-schema/experimental/form`](https://github.com/remix-run/remix/blob/main/packages/data-schema/src/experimental-form/README.md), then connect controls, labels, and errors with `Context` and role mixins.

```tsx
import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/experimental/form'
import { email, minLength } from 'remix/data-schema/checks'
import * as form from '@remix-run/ui/form'
import type { FieldBinding } from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/experimental/form'
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
          <Field field={fields.email} label="Email" type="email" />
          <Field field={fields.password} label="Password" />
          <button type="submit">Sign up</button>
        </form>
      )}
    </form.Context>
  )
}

function Field(
  handle: Handle<{ field: FieldBinding<'text' | 'password'>; label: string; type?: 'email' }>,
) {
  return () => {
    let { field, label, type } = handle.props
    return (
      <>
        <label mix={form.label(field)}>{label}</label>
        <input type={type ?? field.kind} mix={form.control(field)} />
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

Pass failures directly to Context to restore values and show errors. Sensitive fields and files are never restored; success still returns their validated values. Handlers can also construct a `FormSubmission` for business failures. See [form schemas](https://github.com/remix-run/remix/blob/main/packages/data-schema/src/experimental-form/README.md) for decoding, sensitivity, and message options.

## Context and mixins

- `Context` supplies stable typed `fields` and grouped submission `errors`; `errors.form` is absent when there are no form-level messages. Bindings belong to one Context. Changing the schema requires a new keyed Context.
- `root()` enhances native invalid feedback for unmanaged controls without intercepting submission.
- `control(field)` provides constraints, restored defaults, native validity, touched state, and ARIA. Compatible authored props win. Existing `aria-describedby` help IDs are retained; custom control IDs need matching labels.
- `label(field, value?)` supplies `htmlFor`; pass the option value for radio or grouped checkbox labels. `error(field)` supplies an error ID. Content, visibility, roles, and styling remain in JSX.

Use unique Context IDs for multiple forms. Pass a client entry's `handle.id` to preserve IDs during hydration. Pass bindings through ordinary props, and read `field.errors`, `field.touched`, and `handle.props` during rendering. Context rerenders child fields when feedback changes; setup-time destructuring captures a snapshot.

## Control types

Choose a descriptor for the submitted value and set presentation types in markup:

| Descriptor                             | Native controls                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `fd.text(schema)`                      | text, email, url, search, tel, date, month, week, time, datetime-local, color, hidden, radio, select, textarea |
| `fd.password(schema)`                  | password                                                                                                       |
| `fd.number(schema)`                    | number, range                                                                                                  |
| `fd.checkbox(schema?)`                 | one boolean checkbox                                                                                           |
| `fd.fields(schema)`                    | multiple select or a group of string-valued checkboxes                                                         |
| `fd.file(schema)` / `fd.files(schema)` | file; `files` supplies `multiple`                                                                              |

Date/time and color stay strings; range becomes a number. Author date/time bounds and steps in markup. Hidden controls retain server validation and restoration but cannot block browser submission. Author buttons and submit/reset/image inputs normally; text bindings on action inputs supply ID, name, and type without validation or restoration.

Radio options share one text binding. For example, define `delivery: fd.text(s.enum_(['email', 'sms']))`, then render this inside Context:

```tsx
<fieldset>
  <legend>Delivery method</legend>
  <input type="radio" value="email" mix={form.control(fields.delivery)} />
  <label mix={form.label(fields.delivery, 'email')}>Email</label>
  <input type="radio" value="sms" mix={form.control(fields.delivery)} />
  <label mix={form.label(fields.delivery, 'sms')}>SMS</label>
</fieldset>
```

The group shares feedback and restores its selected option. For multiple selections, define `topics: fd.fields(s.array(s.string()))`, then use a select:

```tsx
<select mix={form.control(fields.topics)}>
  <option value="typescript">TypeScript</option>
  <option value="css">CSS</option>
</select>
```

The mixin supplies `multiple`. Alternatively, render the fieldset above with checkbox inputs and the `topics` binding. Disabled options are excluded; no selection is `[]`. Failed arrays restore selected or checked defaults. Author initial selections with array `defaultValue` on a multiple select or `defaultChecked` on checkboxes. Single selects use `defaultValue`, without per-option `selected` flags.

Use array validation or refinements to require selections. Native select requiredness can enforce one selection; checkbox-group rules run in JavaScript and in the handler. Without JavaScript, the server enforces them. Repeated free-text inputs and indexed field arrays need application-owned UI handling.

For uploads, define fields with `fd.file` or `fd.files`, render `<input mix={form.control(fields.avatar)} />`, and set `encType="multipart/form-data"` on the form. A new failure clears live selections; ordinary rerenders preserve them. `accept` is a browser hint; validate and store uploads in the handler.

## Feedback and restoration

Client errors appear after blur or blocked submission, then update while editing. Server errors appear immediately; editing replaces them with current client feedback. Programmatic edits need an `input` or `change` event.

A new submission object refreshes feedback, restored values, and native reset defaults. Reuse its identity until another submission arrives so unrelated renders preserve user edits. A non-canceled native reset restores defaults and clears touched state and custom errors. Applications own fetching, navigation, and pending state.

Descriptor `errorMap` options customize schema messages and supported native messages. Explicit refinement messages keep precedence; native-only pattern and step failures keep browser wording.

`field.setCustomErrors(['Already in use'])` adds errors for the current value without replacing native/schema errors or marking the field touched. It blocks native submission immediately; errors clear on a changed value, non-canceled reset, or new submission. Applications own async requests, debouncing, cancellation, stale-result checks, and server enforcement.

For custom integrations, `getConstraints(schema, { type, multiple? })` projects supported `required`, length, range, and numeric `step="any"` attributes. It reads schema metadata through `remix/data-schema/experimental`. Bounds and length checks after an output transform stay in schema validation instead of restricting raw input. `InputValidationEvent` and `onInputValidation(handler)` expose bubbling notifications with `field`, `errorId`, `errors`, and `touched`; Context handles its own updates.

SSR provides constraints, restored defaults, labels, errors, and ARIA. Native and server validation remain correct without JavaScript; JavaScript adds schema checks and interactive feedback before submission.
