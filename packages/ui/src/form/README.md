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

`fd.parseSafe(Signup, data)` is server-safe and delegates to the shared schema parser once. Success contains typed, transformed `value`. Failure contains `values`, grouped `errors.fields` and optional `errors.form`, and issues projected to messages and logical paths. Failed values preserve raw text, number text, checkbox states, and repeated text. Sensitive fields, files, and arbitrary issue metadata are omitted. Passwords are always sensitive; other scalar fields can opt in with `{ sensitive: true }`. Successful parsing still returns their validated values. Keep secrets out of application-authored messages.

`FormSubmission` and the result types belong to `remix/data-schema/form`. Context consumes failed results directly, including application-authored business failures using the same values/errors shape. `fd.parse` returns validated output or throws; core `s.parseSafe` keeps its ordinary issues-only failure contract. Handlers own business checks, generated values, persistence, authentication, and request handling.

## Context and role mixins

`Context` owns one form instance and supplies stable typed `fields` and current grouped errors. Its render prop always receives `errors`; `errors.form` is absent when there are no form-level messages. A separate domain schema is optional: reuse `Account.shape.email` inside `fd.text()` or define validations inline. Changing the schema requires a new keyed Context.

- `root()` coordinates native invalid feedback for unmanaged controls. It leaves valid submissions to the browser and application.
- `control(field)` provides constraints, restored defaults, native validity, touched state, and ARIA. It defaults the input type from the decoding kind; compatible authored types override it. Text entries also support single-select and textarea. Repeated text entries support multiple selects and checkbox groups.
- `label(field, value?)` supplies `htmlFor`; pass the option value for a radio or grouped checkbox label. `error(field)` supplies an error ID. Content, visibility, roles, and styling remain in JSX.

Bindings belong to their Context and cannot be shared between form instances. IDs default to the Context's instance scope. The component runtime only preserves a client entry's own handle ID during hydration: pass that entry's `handle.id` as Context's `id`, as above, when exact SSR IDs must persist. Explicit scopes must be unique. Authored props win; an explicit control ID needs matching label/error associations. Existing help-text IDs in `aria-describedby` are retained.

`getConstraints(schema, { type, multiple? })` exposes recognized native constraints for custom integrations: `required`, `minLength`, `maxLength`, `min`, and `max`, plus `step="any"` for number and range inputs. Its `type` option accepts the supported native input literals, `select`, and `textarea`. It only derives attributes supported by the native control. Date/time bounds and steps remain authored props. Hidden and action controls receive no validation constraints; range and color inputs do not receive `required`. Arbitrary refinements are checked with `setCustomValidity` after native constraints pass. Requiredness may evaluate schemas when metadata cannot determine it; multiple-value controls use `[]` as their missing value. Checkbox groups do not receive per-option `required`, which would require every option.

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

Radio options share one text binding, feedback, and submitted name. Use a fieldset and legend for the group:

```tsx
let Preferences = fd.object({ delivery: fd.text(s.enum_(['email', 'sms'])) })

<form.Context schema={Preferences}>
  {({ fields }) => (
    <form method="post" mix={form.root()}>
      <fieldset>
        <legend>Delivery method</legend>
        <input type="radio" value="email" mix={form.control(fields.delivery)} />
        <label mix={form.label(fields.delivery, 'email')}>Email</label>
        <input type="radio" value="sms" mix={form.control(fields.delivery)} />
        <label mix={form.label(fields.delivery, 'sms')}>SMS</label>
        {fields.delivery.errors.length > 0 && (
          <p role="alert" mix={form.error(fields.delivery)}>
            {fields.delivery.errors.join(' ')}
          </p>
        )}
      </fieldset>
      <button type="submit">Save</button>
    </form>
  )}
</form.Context>
```

Option values produce distinct scoped control IDs. Authored IDs require matching label associations. A failed value restores the selected option and its native reset default; ordinary rerenders preserve the current selection. Client validation reads the selected enabled option in the native form/name group.

File controls validate selected files with the original schema:

```tsx
let Upload = fd.object({
  avatar: fd.file(s.optional(s.instanceof_(Blob))),
  attachments: fd.files(s.array(s.instanceof_(Blob))),
})

<form.Context schema={Upload}>
  {({ fields }) => (
    <form method="post" encType="multipart/form-data" mix={form.root()}>
      <label mix={form.label(fields.avatar)}>Avatar</label>
      <input accept="image/*" mix={form.control(fields.avatar)} />
      <label mix={form.label(fields.attachments)}>Attachments</label>
      <input mix={form.control(fields.attachments)} />
      <button type="submit">Upload</button>
    </form>
  )}
</form.Context>
```

No selection becomes `undefined` for a single file or `[]` for multiple files. Use a refinement rejecting `[]` to require multiple uploads. Files are omitted from failed values, and a new failed submission clears live selections. Ordinary rerenders preserve selections. The application owns upload storage and server enforcement; `accept` is a browser hint.

## Multiple values

Use `fd.fields` for one multiple select or one same-name checkbox group. The schema validates an array of selected strings; no selection is `[]`. Blank strings remain strings, following the repeated-entry parser's existing behavior.

```tsx
let Preferences = fd.object({
  topics: fd.fields(
    s.array(s.string()).refine((values) => values.length > 0, 'Choose a topic'),
  ),
})

<form.Context schema={Preferences}>
  {({ fields }) => (
    <form method="post" mix={form.root()}>
      <label mix={form.label(fields.topics)}>Topics</label>
      <select multiple mix={form.control(fields.topics)}>
        <option value="typescript">TypeScript</option>
        <option value="css">CSS</option>
      </select>
      {fields.topics.errors.length > 0 && (
        <p role="alert" mix={form.error(fields.topics)}>
          {fields.topics.errors.join(' ')}
        </p>
      )}
      <button type="submit">Save</button>
    </form>
  )}
</form.Context>
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

Checkbox options share errors and touched state, with distinct IDs for their labels. Client validation reads checked enabled options in the native form/name group. Disabled options are also excluded from multiple-select validation. Failed arrays restore selected or checked defaults on the server and on new submissions; ordinary rerenders preserve edits, and native reset returns to those defaults. Author initial selections with array `defaultValue` on a multiple select or `defaultChecked` on each checkbox.

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
