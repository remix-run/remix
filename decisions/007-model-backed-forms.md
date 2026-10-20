# Schema-backed fields with native validation and mixin-owned feedback

We chose schema-backed field definitions and setup-scoped mixins rather than components that prescribe form markup. Definitions connect parsing and native constraints; mixins coordinate browser feedback while applications own DOM structure and error UI.

HTML constraints, field configuration, parsing, and mixins live together in `ui/form`. This keeps a field's configuration in one place without adding browser concepts to `data-schema`, which owns validation and generic `getSchemaMetadata()` introspection. Definitions and parsing remain server-safe.

## A form describes an operation, not a database record

`createForm({ schema: Account, fields })` selects model fields and adds UI metadata outside the model, allowing one schema to support different forms. Selected fields inherit their schemas; request-only fields supply their own. Omitting `schema` requires a schema on every field. `createField()` defines a reusable field for standalone use or form composition; object schemas expose `.shape` for reuse across models. The [guide][form-docs] shows all four configurations.

Parsing validates only configured fields, not a complete database record. Handlers supply generated values, run business checks, and select values for persistence. The [demo handler][registration-action] assembles an account; the [table validation hook][account-table] validates the complete record before writing it.

## Native constraints remain primary

We chose the browser's [Constraint Validation API][constraint-validation] over a replacement submission-validation engine. `getConstraints()` derives supported attributes, and field definitions expose requiredness for labels. Control mixins emit SSR attributes, check native validity first, and run synchronous field-schema validation when native checks pass. Schema failures use `setCustomValidity()` to preserve native submission blocking.

Without JavaScript, native constraints and server validation still work; failed responses restore non-password values and render errors. We chose functional parity, not identical timing or tooltips.

## Bindings own feedback, applications own markup

`createFieldMixins()` binds one control; `createFormMixins()` composes bindings for a form. Both provide control, label, and error mixins with live errors and touched state. Independent bindings can share a native form, with the application combining their server results.

We chose setup-scoped bindings over separately wiring attributes, validators, and feedback tracking. `getSubmission` reads current props during rendering or state access; a new submission identity resets feedback. `onChange` requests a render when visible state changes. This avoids rebinding on each render while keeping prop changes explicit.

Controls validate while typing, but client feedback appears only after blur or a native invalid event. Server errors appear immediately and persist until editing. Mixins manage error accessibility; applications choose content, styles, and announcement roles. Attribute-only `label()` and `error()` mixins keep composition consistent without adding behavior.

## One field-level map customizes messages

We chose field-level `errorMap` over a mixin-only hook, a separate native-message map, or message arguments on each schema helper. Schema/domain codes let server parsing and browser feedback share wording without exposing browser validity flags in `data-schema`. Required empty-value failures use `value.required`; existing schema message precedence is unchanged. Explicit refinement messages and uncoded checks bypass mapping; refinements without messages use `refine.failed`.

The browser adapter maps supported native failures to those codes and synchronously sets the primary message, aligning tooltips and inline feedback. Native-only constraints and no-JavaScript tooltips keep browser wording. Message overrides add no validation: an email input still needs a server-side email check.

## Applications orchestrate asynchronous checks

`setCustomErrors(messages)` adds errors for the current control value without replacing native/schema errors or marking the field touched. They survive revalidation and clear on value changes, non-canceled reset, or a new submission.

We chose this bridge over a `validations` API that would own debouncing, cancellation, stale-result protection, and pending/failure state. Applications retain that orchestration without duplicating validation or accessibility behavior. Pending checks do not delay submission; server checks and database uniqueness remain authoritative.

## Cross-field validation stays explicit

Running a backing object schema could reject valid partial submissions. Requiring every model field would be unnecessarily restrictive when a refinement uses only some, but arbitrary predicates do not declare their dependencies.

For now, the backing schema must expose `.shape`; an object-level `.refine()` returns a general schema that does not satisfy that contract. Handlers run cross-field checks separately and return form or field errors. Field-level refinements remain supported.

## When to revisit

1. Add opt-in object-level validation when concrete workflows establish a dependency or missing-value policy.
2. Add asynchronous orchestration if application-owned checks plus `setCustomErrors()` prove insufficient.
3. Add higher-level field components when repeated markup establishes defaults without constraining DOM structure.

[form-docs]: ../packages/ui/src/form/README.md#form-definitions
[registration-action]: ../demos/data-model-forms/app/actions/extra-fields/controller.tsx
[account-table]: ../demos/data-model-forms/app/data/account.ts
[constraint-validation]: https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
