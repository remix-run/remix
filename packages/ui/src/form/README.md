# form

`createFormMixins(formDefinition, options)` creates related form, input, and error mixins with live validation messages. The application owns the input and error markup.

```tsx
import * as s from 'remix/data-schema'
import { createForm } from 'remix/data-schema/form'
import type { FormSubmission } from 'remix/data-schema/form'
import type { Handle } from 'remix/component'
import { createFormMixins } from '@remix-run/ui/form'

let Signup = createForm(s.object({ email: s.string() }), {
  fields: { email: { label: 'Email', type: 'email' } },
})

function SignupPage(handle: Handle<{ submission?: FormSubmission }>) {
  let { form, input, error, errors } = createFormMixins(Signup, {
    getSubmission: () => handle.props.submission,
    onChange: () => handle.update(),
  })

  return () => (
    <form method="post" mix={form()}>
      <label {...Signup.getLabelAttrs('email')}>{Signup.fields.email.label}</label>
      <input autoComplete="email" mix={input('email')} />
      {errors.email.length > 0 ? (
        <p mix={error('email')} role="alert">
          {errors.email.join(' ')}
        </p>
      ) : null}
      <button type="submit">Create account</button>
    </form>
  )
}
```

## `createFormMixins(formDefinition, { getSubmission, onChange }?)`

Create the binding once per component instance in setup. Its methods can be destructured: `form()` enhances unmanaged native controls, `input(field)` supplies each projected input's behavior, and `error(field)` supplies the generated error-element id. The binding owns field feedback, so ordinary renders preserve touched state and edited messages. Separate bindings keep independent state even when they share a definition.

The optional `getSubmission` getter reads the current server submission when rendering inputs or reading `errors`, including SSR. It does not subscribe to changes: update component props or call `handle.update()` after changing a local submission. Return the same submission object until it changes; a new submission object resets field feedback to the new server errors without firing `onChange`.

`errors` is a stable, read-only object with a message array for every projected field. Read `errors.email` during rendering to get current visible client messages or server errors, even before the input renders. Destructuring a field array in setup captures that array rather than future replacements. No manual error map or submission-change tracking is needed.

The optional `onChange` callback requests a component render when visible client messages change. It is not called for unchanged messages or pristine typing that reveals no error. Without it, input validation and ARIA still update, and `errors` stays current, but application-owned error markup needs another way to request rendering.

Each input mixin:

- applies generated ids, names, types, native constraints, restored values, and server error attributes during SSR
- validates initial values, then validates on input and blur using native constraints first and synchronous schema validation through `setCustomValidity()` when native constraints pass
- reveals errors after the first blur or native `invalid` event, and updates feedback as the user types
- preserves server errors until the field is edited, then replaces them with current client feedback
- sets `data-touched`, `aria-invalid`, and error-description linkage, preserving other `aria-describedby` ids
- preserves explicit host props, so authored attributes such as `autoComplete`, `aria-invalid`, or an intentional `type` override win

Apply the returned mixin to every projected input, including fields whose schemas map entirely to native constraints. This keeps native and custom validation on one rendering path.

## `error(field)`

The returned error mixin applies the generated id during SSR and client rendering. It does not add listeners, change content or visibility, or choose a live-region role. Explicit host props override its defaults; keep the generated id to preserve the input's automatic error linkage. Choose your own error element, styles, and announcement behavior.

## `onInputValidation(handler)`

An optional lower-level observer. Apply it to an input or its form to receive bubbling `rmx:input-validation` events with `field`, `errorId`, `errors`, and `touched`. The event's `errors` array contains only messages that should be displayed; it is empty for pristine inputs. Observing these events does not disable the default input behavior or the binding's live errors.

Use `errors` and `onChange` for ordinary error rendering. Use this observer for custom event handling or inspection of touched state. The mixins never create, hide, or change the text of the application's error elements.

## `form()`

The standalone `form()` export returns a mixin for plain inputs, selects, and textareas. This is the same behavior supplied by the `form()` method returned from `createFormMixins()`. It:

- leaves fields unmarked while the user types before their first blur
- sets `data-touched` and synchronizes `aria-invalid` after blur
- observes native `invalid` events when the browser blocks submission
- clears stale server error linkage after an invalid field changes

Managed inputs own this behavior themselves. The form mixin skips them, so mixed forms can use both APIs without duplicate handling.

Without JavaScript, native constraints still prevent invalid submissions and server-rendered errors remain accessible. Do not add `noValidate` unless the application intentionally opts out of native constraint validation.
