# form

`createFieldMixins()` binds a reusable field to a native input, select, or textarea. `createFormMixins()` composes the same behavior for all fields in a form definition. Applications own the markup, styles, and displayed errors.

## A standalone field

```tsx
import * as s from 'remix/data-schema'
import { createField } from 'remix/data-schema/form'
import { createFieldMixins } from '@remix-run/ui/form'

let Email = createField({ schema: s.string(), label: 'Email', type: 'email' })

// In component setup:
let email = createFieldMixins(Email, {
  name: 'email',
  getSubmission: () => handle.props.submission,
  onChange: () => handle.update(),
})

return () => (
  <form method="post">
    <label {...Email.getLabelAttrs('email')}>{Email.label}</label>
    <input autoComplete="email" mix={email.field()} />
    {email.errors.length > 0 ? (
      <p role="alert" mix={email.error()}>
        {email.errors.join(' ')}
      </p>
    ) : null}
    <button type="submit">Save</button>
  </form>
)
```

Create one binding per control in component setup. Definitions can be shared, but bindings have independent state. Multiple independent bindings can appear inside one ordinary `<form>`: native submission collects their values and blocks invalid controls. The handler can parse them separately with `Email.parse(formData, 'email')`, or compose their definitions into `createForm({ fields: { email: Email } })` for combined parsing and failed-submission handling.

## A form binding

```tsx
import * as s from 'remix/data-schema'
import { createForm } from 'remix/data-schema/form'
import type { FormSubmission } from 'remix/data-schema/form'
import type { Handle } from 'remix/component'
import { createFormMixins } from '@remix-run/ui/form'

let Signup = createForm({
  schema: s.object({ email: s.string() }),
  fields: { email: { label: 'Email', type: 'email' } },
})

function SignupPage(handle: Handle<{ submission?: FormSubmission }>) {
  let { form, field, error, fields } = createFormMixins(Signup, {
    getSubmission: () => handle.props.submission,
    onChange: () => handle.update(),
  })

  return () => (
    <form method="post" mix={form()}>
      <label {...Signup.getLabelAttrs('email')}>{Signup.fields.email.label}</label>
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

## `createFormMixins(formDefinition, { getSubmission, onChange }?)`

Create the binding once per component instance in setup. Its methods can be destructured: `form()` enhances unmanaged native controls, `field(name)` supplies each projected control's behavior, and `error(name)` supplies the generated error-element id. Each field uses the same binding machinery as `createFieldMixins()`. `input(name)` remains an alias for `field(name)`, and `errors.name` reads the same messages as `fields.name.errors`.

The optional `getSubmission` getter reads the current server submission when rendering controls or reading state, including SSR. It is not a subscription: update component props or call `handle.update()` after changing a local submission. Return the same object until it changes; a new identity resets touched state and reads the new server messages without firing `onChange`.

## Live field state

Standalone bindings expose these properties directly; form bindings expose them through `fields.name`:

- `errors`: visible client messages or server errors; empty for pristine client fields
- `touched`: feedback has been revealed by blur, a native invalid event, or editing a server error

Server errors are visible immediately, even while `touched` is false. Once true, `touched` stays true until a reset or new submission.

The objects are stable and read-only. Read properties during rendering; destructuring a boolean or message array in setup captures a snapshot. `onChange` requests a render when messages or touched state change, including the first blur of a valid field. It does not fire for edits or blurs that leave both unchanged. Without it, validation and ARIA still update, but application-owned UI needs another render trigger.

A non-canceled native form reset clears touched state and displayed errors. Programmatic value changes require an `input` or `change` event to refresh validation.

## Control behavior

Each input mixin:

- applies generated ids, names, types, native constraints, restored values, and server error attributes during SSR
- validates initially and on `input`, `change`, and blur using native constraints first and synchronous schema validation through `setCustomValidity()` when native constraints pass
- reveals errors after the first blur or native `invalid` event, and updates feedback as the user types
- preserves server errors until the field is edited, then replaces them with current client feedback
- sets `data-touched`, `aria-invalid`, and error-description linkage, preserving other `aria-describedby` ids
- preserves explicit host props, so authored attributes such as `autoComplete`, `aria-invalid`, or an intentional `type` override win

Apply the returned mixin to every projected input, including fields whose schemas map entirely to native constraints. This keeps native and custom validation on one rendering path.

Use `type: 'text'` for string-valued select/textarea definitions; the mixin omits the input-only `type` attribute on these elements. Single-value native selects are supported. Applications own option markup, including `selected` attributes when restoring a server-rendered selection. Multi-select arrays and radio groups are not modeled by this scalar field API.

## `error(field)`

The returned error mixin applies the generated id during SSR and client rendering. It does not add listeners, change content or visibility, or choose a live-region role. Explicit host props override its defaults; keep the generated id to preserve the input's automatic error linkage. Choose your own error element, styles, and announcement behavior.

## `onInputValidation(handler)`

An optional lower-level observer. Apply it to a control or ancestor to receive bubbling `rmx:input-validation` events with `field`, `errorId`, `errors`, and `touched`. Events are snapshots; binding state remains live. The event's errors contain only messages that should be displayed. Observing does not disable default behavior.

Use `errors` and `onChange` for ordinary error rendering. Use this observer for custom event handling or inspection of touched state. The mixins never create, hide, or change the text of the application's error elements.

## `form()`

The standalone `form()` export returns a mixin for plain inputs, selects, and textareas. This is the same behavior supplied by the `form()` method returned from `createFormMixins()`. It:

- leaves fields unmarked while the user types before their first blur
- sets `data-touched` and synchronizes `aria-invalid` after blur
- observes native `invalid` events when the browser blocks submission
- clears stale server error linkage after an invalid field changes

Managed inputs own this behavior themselves. The form mixin skips them, so mixed forms can use both APIs without duplicate handling.

Without JavaScript, native constraints still prevent invalid submissions and server-rendered errors remain accessible. Do not add `noValidate` unless the application intentionally opts out of native constraint validation.
