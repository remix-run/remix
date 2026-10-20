# Schema-backed fields with native validation and mixin-owned feedback

We chose reusable field definitions in `data-schema` and setup-scoped browser bindings in `ui`. Definitions connect schema validation, native HTML constraints, and submitted values; mixins coordinate feedback without choosing DOM structure or error markup.

## A form describes an operation, not a database record

`createForm({ schema: Account, fields })` selects model fields and adds labels, input types, names, and ids. This metadata stays outside the model so one schema can support different forms. Selected fields inherit their schemas; request-only fields supply their own. Model fields cannot override their schemas. Omitting `schema` requires every field to provide one.

`createField({ schema, label, type })` supplies the same decoding and validation for a standalone field or an entry in `createForm({ fields })`. Object schemas expose `.shape` so forms spanning multiple models can reuse individual field rules. The [package guide][form-docs] shows all four configurations.

Parsing validates only configured fields. A form may omit a generated id or add a password and terms checkbox, so its parsed value is not necessarily a complete model. Handlers own business checks, credentials, generated values, transactions, and selecting values for persistence. The [demo handler][registration-action] assembles an account; the [table validation hook][account-table] validates the complete record before writing it.

## Native constraints remain primary

We chose the browser's [Constraint Validation API][constraint-validation] rather than replacing submission checks with a JavaScript validation engine. `getConstraints()` derives supported attributes from schema metadata and input context. Field definitions also expose requiredness for application-owned labels.

The control mixin emits attributes during SSR, checks native validity first, and runs synchronous field-schema validation when native checks pass. Schema messages use `setCustomValidity()`, preserving native submission blocking. Without JavaScript, native constraints and server validation still work; failed responses restore non-password values and render errors. We chose functional parity, not identical timing or tooltips.

## Bindings own feedback, applications own markup

`createFieldMixins()` binds one control. `createFormMixins()` composes those bindings and exposes `form`, `field`, `label`, and `error` mixins plus live `fields.name.errors` and `touched` state. Independent bindings can also share an ordinary native form; applications then coordinate their server parsing and submissions.

We chose setup-scoped bindings over separately wiring attributes, validators, client error maps, and submission tracking. `getSubmission` reads current props during rendering or state access; a new submission identity resets feedback. It is not a subscription. `onChange` requests a render when visible errors or touched state change. Reading live state during rendering avoids capturing a setup-time snapshot.

Controls validate while typing, but client feedback appears only after blur or a native invalid event. Server errors appear immediately and persist until editing. Mixins manage `aria-invalid` and error-description linkage; applications choose error content, visibility, styles, and announcement roles. `label()` and `error()` are attribute-only mixins for consistent composition. Low-level attribute helpers and `onInputValidation()` remain available for custom integrations. See the [UI guide][mixin-docs].

## One field-level map customizes messages

We chose an optional `errorMap` on field definitions over a mixin-only hook, a separate native-message map, or message arguments on each schema helper. Schema/domain codes keep browser vocabulary out of the server API. Explicit check and refinement messages are overridable defaults; returning `undefined` preserves them. Required empty form values use `value.required`, while other failures retain their schema codes.

The browser adapter maps supported native failures to those codes and sets the resolved primary message synchronously, aligning tooltips and inline feedback. Native-only constraints keep browser wording. A message override adds no validation: an email input still needs an email schema check on the server. Without JavaScript, native tooltips remain unchanged.

## Applications orchestrate asynchronous checks

`setCustomErrors(messages)` supplies supplemental errors for the current control value. They survive revalidation and clear on value changes, non-canceled reset, or a new submission. Native/schema errors remain primary, and setting custom errors does not mark a field touched.

We chose this bridge over a `validations` API that would also own debounce timing, cancellation, stale-result protection, and pending/failure state. Applications can compose event mixins and request tools without duplicating validation or accessibility behavior. Pending checks do not delay submission; server business checks and database uniqueness remain authoritative.

## Cross-field validation stays explicit

Running a backing object schema could reject valid partial submissions, while selecting field schemas cannot preserve object-level relationships. Requiring all model fields would be unnecessarily restrictive when a refinement uses only some of them, and arbitrary predicates do not declare their dependencies.

For now, the backing schema must expose `.shape`; an object-level `.refine()` returns a general schema that does not satisfy that contract. Handlers run cross-field checks separately and return form or field errors. Field-level refinements remain supported.

## When to revisit

1. Add opt-in object-level validation when concrete workflows establish a dependency or missing-value policy.
2. Add asynchronous orchestration if application-owned checks plus `setCustomErrors()` prove insufficient.
3. Add higher-level field components when repeated markup establishes defaults without constraining DOM structure.

[form-docs]: ../packages/data-schema/README.md#model-backed-forms
[mixin-docs]: ../packages/ui/src/form/README.md
[registration-action]: ../demos/data-model-forms/app/actions/extra-fields/controller.tsx
[account-table]: ../demos/data-model-forms/app/data/account.ts
[constraint-validation]: https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
