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
          {errors.form.length > 0 && <p role="alert">{errors.form.join(' ')}</p>}
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
let submission = Signup.parseSafe(await request.formData())
if (!submission.success) {
  return render(<SignupForm submission={submission} />, { status: 400 })
}
await createAccount(submission.value)
```

`Signup.parseSafe` is server-safe and delegates to the shared schema parser once. The equivalent functional API is `fd.parseSafe(Signup, data)`. Success contains typed, transformed `value`. Failure contains `values`, grouped `errors.fields` / `errors.form`, and issues projected to messages and logical paths. Failed values preserve raw text, number text, checkbox states, and repeated text. Passwords, files, and arbitrary issue metadata are omitted. Keep secrets out of application-authored messages.

`FormSubmission` and the result types belong to `remix/data-schema/form`. Context consumes failed results directly, including application-authored business failures using the same values/errors shape. `Signup.parse` and `fd.parse` return validated output or throw; core `s.parseSafe` keeps its ordinary issues-only failure contract. Handlers own business checks, generated values, persistence, authentication, and request handling.

## Context and role mixins

`Context` owns one form instance and supplies stable typed `fields` and current grouped errors. A separate domain schema is optional: reuse `Account.shape.email` inside `fd.text()` or define validations inline. Changing the schema requires a new keyed Context.

- `root()` coordinates native invalid feedback for unmanaged controls. It leaves valid submissions to the browser and application.
- `control(field)` provides constraints, restored defaults, native validity, touched state, and ARIA. It defaults the input type from the form kind. Text fields allow authored `email`, `url`, `search`, and `tel` types; incompatible types fail clearly. Scalar text also supports select and textarea. Repeated/file entries are parser-only in this release.
- `label(field)` supplies `htmlFor`; `error(field)` supplies an error ID. Content, visibility, roles, and styling remain in JSX.

Bindings belong to their Context and cannot be shared between form instances. IDs default to the Context's instance scope. The component runtime only preserves a client entry's own handle ID during hydration: pass that entry's `handle.id` as Context's `id`, as above, when exact SSR IDs must persist. Explicit scopes must be unique. Authored props win; an explicit control ID needs matching label/error associations. Existing help-text IDs in `aria-describedby` are retained.

`getConstraints(schema, { type })` exposes recognized native constraints for custom integrations: `required`, `minLength`, `maxLength`, `min`, and `max`, plus `step="any"` for numeric fields. Arbitrary refinements are checked with `setCustomValidity` after native constraints pass. Requiredness may evaluate schemas when metadata cannot determine it.

## Live state and component props

Pass `FieldBinding<'text'>`, `FieldBinding<'password'>`, or another scalar kind through ordinary props. Read `field.errors`, `field.touched`, and `handle.props` during rendering. Setup-time destructuring captures a snapshot. Context updates rerender child fields even when binding identity is unchanged; no subscriptions or update callbacks are needed.

Client errors appear after blur or blocked submission, then update while editing. Server errors appear immediately; editing replaces them with current client feedback. A non-canceled native reset clears touched state and custom errors after native defaults restore. Programmatic edits need an `input` or `change` event.

A new submission object refreshes feedback and restored values. Reuse its identity until another submission arrives so unrelated renders preserve user edits. Applications own fetching, navigation, and pending state.

## Shared messages and supplemental errors

Configure `errorMap` on an `fd.text`, `fd.password`, `fd.number`, or `fd.checkbox` descriptor. It customizes schema messages and supported native messages using domain codes such as `value.required`, `type.number`, `string.email`, `string.url`, `string.min_length`, `string.max_length`, `number.min`, and `number.max`. Explicit refinement messages retain precedence; refinements without messages use `refine.failed`. Native-only pattern and step failures keep browser wording.

`field.setCustomErrors(['Already in use'])` adds supplemental errors for the current control value without replacing native/schema errors or marking the field touched. Errors block native submission immediately. They survive same-value revalidation and clear on changed value, non-canceled reset, or a new submission. Applications own async requests, debouncing, cancellation, stale-result checks, and server enforcement.

`InputValidationEvent` and `onInputValidation(handler)` expose bubbling feedback notifications for integrations. Context handles its own updates.

## Without JavaScript

SSR provides native constraints, values, labels, errors, and accessibility associations. Native validation and server validation remain correct without JavaScript. JavaScript adds schema validation before submission and interactive feedback; no-JavaScript timing and tooltips follow browser behavior.
