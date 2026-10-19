# Model-backed forms with native validation and mixin-owned feedback

We chose field-level form projections in `data-schema` and setup-scoped form mixins in `ui`. A form reuses model validation rules without becoming a database record, a component tree, or a client-side submission framework.

The starting point was an existing data model, server request validation, and UI primitives for native controls. Connecting them required repeating constraints, handling failed values, and coordinating client errors. We wanted those connections without requiring generated layouts or wrapper components.

## A form describes an operation, not a persisted object

`createForm({ schema: Account, fields })` selects the model fields used by an operation and adds UI metadata such as labels, input types, names, and ids. Keeping this metadata outside `Account` lets the same model support different forms without acquiring presentation concerns.

Selected fields inherit their schemas. Fields absent from the model must provide an inline schema, and model fields cannot override their authoritative schema. These rules are enforced by TypeScript and checked at runtime. Omitting a model field means the form does not validate it; it does not make that field optional in the model. See `packages/data-schema/src/lib/form.ts`.

This supports four configurations without four separate form APIs: selecting fields from one schema, adding inline ancillary fields, composing fields from multiple schemas through `.shape`, and omitting the backing `schema` to define every field inline. The [package README][form-docs] shows each variation. Exposing `.shape` makes existing field schemas reusable rather than requiring duplicate definitions.

`Form.parse(formData)` decodes and validates the configured fields. A registration form can omit a server-generated account id and include a password or terms checkbox that is not an account property. Successful parsing therefore does not establish that the result is a complete, valid `Account`.

The handler owns the remaining operation: business checks, generated values, credential handling, splitting values across tables, and transactions. Persistence validation is separate. In the [registration demo][registration-action], the handler assembles an account and the [table validation hook][account-table] validates the complete record with `Account` before writing it. A form definition does not save anything automatically.

## Fields compose into forms

`createField({ schema, label, type })` describes a reusable field without browser state or an assigned logical name. It can parse independently with `Field.parse(formData, name)` or appear in `createForm({ fields: { name: Field } })`. `createForm()` resolves every field through this same field layer, including fields inherited from its backing schema. This keeps decoding, constraints, and server error handling consistent.

`createFieldMixins(Field, { name, getSubmission, onChange })` owns one native control's feedback. `createFormMixins()` composes independent field bindings rather than providing a separate validation implementation. Independently bound controls can also share an ordinary native form; the browser collects values and blocks invalid controls. The application then supplies each binding's submission/render wiring and either parses each definition separately or composes a form definition for combined values and errors.

The live state is `fields.name.errors/touched` on form bindings and direct properties on standalone bindings. `touched` becomes true after blur, a native invalid event, or editing a field with server errors. Server errors are visible immediately regardless of touched state. New server submissions reset touched state. Native reset clears touched state and visible errors unless canceled. `onChange` reports changes to errors or touched state, including the first blur of a valid field, but not edits or blurs that leave both unchanged. The `field()` mixin supports inputs, selects, and textareas; `input()` and top-level `errors` remain available on form bindings.

## Native constraints remain the primary browser mechanism

We chose the browser's [Constraint Validation API][constraint-validation] instead of replacing submission checks with a JavaScript validation engine. `getConstraints()` derives supported native attributes from schema checks and input context, including requiredness. Known checks are retained as private schema metadata; consumers use the utility rather than inspecting that metadata. The resolved form fields expose requiredness for labels as well as inputs.

The input mixin emits those attributes during SSR. In the browser it clears stale custom validity, checks native validity first, and runs supplemental synchronous field validation when native constraints pass. Schema issues are reported through `setCustomValidity()`, so native submission blocking still applies. This avoids making ordinary constraints depend on hydration or routing every validation through a custom-only path. See `packages/ui/src/form.ts`.

Without JavaScript, supported HTML constraints still apply and the server validates every configured field. Failed responses restore submitted text and checkbox values and render server errors; password values are deliberately omitted. Non-native rules may require a server round trip. We chose functional parity, not identical timing or presentation. Browser checks never replace server validation.

## Application-owned checks supply supplemental errors

`fields.name.setCustomErrors(messages)` bridges application-owned checks into the existing field behavior. Standalone bindings expose the same method. These messages live separately from schema errors, belong to the current control value, and survive synchronous revalidation. Native/schema errors remain primary. Setting messages updates native validity immediately but does not mark the field touched; visible feedback and error accessibility follow the existing rules. Value changes, non-canceled resets, and new server submissions clear supplemental messages.

We chose this bridge over a `validations` callback API that would own asynchronous checks, debounce timing, cancellation, and pending/failure state. Applications can compose `on()` and their preferred request tools without duplicating field validation or error accessibility. They are responsible for rejecting stale results after typing, reset, or submission changes and for presenting request failures separately from invalid values. Pending work does not implicitly delay submission. Server business checks and database uniqueness remain authoritative.

## One setup-scoped binding owns feedback, not markup

We chose `createFormMixins()` over separately wiring input attributes, validators, event listeners, client error maps, and submission resets. Within component setup:

```tsx
let { form, input, label, error, errors } = createFormMixins(RegistrationForm, {
  getSubmission: () => handle.props.submission,
  onChange: () => handle.update(),
})

return () => (
  <form method="post" mix={form()}>
    <label mix={label('email')}>{RegistrationForm.fields.email.label}</label>
    <input mix={input('email')} />
    {errors.email.length > 0 ? (
      <p role="alert" mix={error('email')}>
        {errors.email.join(' ')}
      </p>
    ) : null}
  </form>
)
```

The factory name avoids the naming collision in `let { form, input } = form(...)`. It also reflects that the binding supplies attributes, restored values, and accessibility wiring, not only validation.

Setup-scoped state preserves interaction flags and edited feedback across renders. `getSubmission` reads current props during rendering or state access, including SSR; a new submission identity resets feedback. It is not a subscription. `onChange` requests rendering when visible messages or interaction flags change, while receiving new submission props remains the application's responsibility.

Inputs validate while typing, but client errors become visible only after blur or a native invalid event. Server errors are visible immediately and remain until that field is edited. The mixin owns that state and its `aria-invalid` and `aria-describedby` wiring. Applications should not need their own parallel error maps or previous-submission tracking.

We chose a stable live `errors` object instead of a per-field error getter. Read `errors.email` during rendering; destructuring a field's array in setup captures a snapshot. `label(field)` associates the label with the configured control id, and `error(field)` supplies the generated error id. Both are attribute-only mixins that keep composition consistent with `form()` and `input()` without deciding content, visibility, styles, or announcement roles. Those remain application-owned. See the [UI form documentation][mixin-docs].

Low-level attribute helpers remain available for custom integrations, and `onInputValidation()` remains an optional event observer. The standalone `form()` mixin supports unmanaged native controls and skips inputs already managed by the binding. Higher-level `<Input field="..." />` components can build on these primitives; they are not required to adopt the behavior.

## Field-level validation is the boundary

We deferred automatic whole-object and cross-field refinements. A projection can omit fields that the original object schema requires. Running that whole schema would reject otherwise valid partial submissions, while running only selected field schemas cannot establish relationships such as start date preceding end date.

Requiring all model fields would be safe but unnecessarily restrictive when a refinement uses only some fields. Arbitrary predicates do not declare those dependencies, so we cannot reliably determine which object rules survive a projection. When supplied, the backing `schema` must be an object schema with `.shape`; object-level `.refine()` returns a general schema that does not satisfy that contract. Field-level refinements remain supported.

For now, handlers run cross-field or business validation as a second step and report failures through the existing form errors or an explicitly selected field. We did not add a parallel callback-based rule language when schema refinements already provide validation machinery.

We chose one options object with an optional `schema` so model-backed and entirely inline forms share the same call shape. Omitting it requires an explicit schema on every configured field, rather than a placeholder empty object schema.

## When to revisit

1. Add object-level validation when concrete workflows justify a dependency or missing-value policy. Any automatic support should be explicit opt-in and preserve existing field-only behavior.
2. Add asynchronous orchestration only if application-owned checks plus `setCustomErrors()` prove insufficient. The mixins do not currently own cancellation, stale-result protection, or waiting for checks before submission.
3. Add higher-level field components when repeated application markup establishes useful defaults without constraining custom DOM structure.

[form-docs]: ../packages/data-schema/README.md#model-backed-forms
[mixin-docs]: ../packages/ui/src/form/README.md
[registration-action]: ../demos/data-model-forms/app/actions/extra-fields/controller.tsx
[account-table]: ../demos/data-model-forms/app/data/account.ts
[constraint-validation]: https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
