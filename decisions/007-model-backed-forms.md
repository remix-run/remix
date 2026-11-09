# Form schemas with native validation and context-scoped feedback

One inspectable form schema connects transport decoding, ordinary validation, and native UI behavior. `data-schema/experimental/form` owns the submission contract; `ui/form` consumes it through a Context and small role mixins. Applications keep control over markup and request handling.

## Form schemas describe submissions

`fd.object({ email: fd.text(getSchemaMetadata(Account).shape.email) })` reuses domain rules without another UI definition. A separate domain schema is optional; inline rules and fields from multiple models work the same way. Only configured fields are parsed. Handlers supply generated values, run business checks, and select values for persistence.

Explicit `text`, `password`, `number`, and `checkbox` descriptions identify transport semantics without inspecting DOM input types or changing ordinary `s.object` parsing. They normalize absence and blanks before running the original schema. The functional `fd.parse` and form-aware `fd.parseSafe` APIs reuse core validation, options, messages, and inferred transforms. The existing `data-schema/form-data` adapter retains its lower-level extraction behavior.

We chose descriptors for decoding and sensitive-value policy instead of a helper for every HTML input type. Email, URL, date/time, color, hidden, and radio values use `text`; range uses `number`. The native type stays in markup. Existing `file` and `files` descriptors handle uploads. Form objects normalize unnamed zero-byte browser upload placeholders to missing values while preserving named empty files and the lower-level adapter's behavior.

Readonly `.entries` preserves original scalar schemas and decoding metadata for adapters. Form kinds and sensitivity belong here; labels, IDs, ARIA, feedback, and browser validity flags remain in UI. Package dependencies flow from UI to data-schema.

## Form APIs and schema inspection stay experimental

We chose `remix/data-schema/experimental/form` for the form schema API and reserved `remix/data-schema/form` for eventual stabilization. The import path makes experimental usage explicit, rather than relying only on documentation at the stable-looking form path. Form descriptors, decoding, submission results, and the consuming `ui/form` bindings and mixins may change or be removed in patch releases. Ordinary schema parsing and the existing `data-schema/form-data` export keep their stable contracts.

We chose `getSchemaMetadata()` from `data-schema/experimental` as the single schema inspection API. It exposes typed property schemas through `metadata.shape`, check descriptions, and known undefined handling without running validators or default factories. We removed the direct `.shape` property and kept inspection out of the stable core export. Experimental additions, changes, and removals ship in patch releases. UI is also unstable and uses a `workspace:*` dependency on data-schema, pinning published releases to the exact tested version while the two APIs evolve together.

We considered adding `.shape` and `getSchemaMetadata()` to the stable API. That would commit to their contracts before the broader inspection model settles. [Inspectable schema objects](https://github.com/remix-run/remix/pull/12106) could later replace the metadata storage or provide a different inspection API. This decision lets us ship forms independently, preserve ordinary schema parsing, and revisit inspection when that representation is adopted.

## Form-aware safe parsing carries failed submissions

We chose `fd.parseSafe(Signup, data)` as the handler's safe parsing API. It keeps the familiar `success`, `value`, and `issues` result shape, while failures also contain raw restorable `values` and grouped errors. `errors.fields` includes only fields with messages, and `errors.form` is absent without form-level messages. `fd.parse(Signup, data)` retains ordinary throwing behavior. We chose functional parsing to match ordinary data-schema APIs and avoid introducing instance methods only on form schemas.

We considered a separate `ui/form.parseSubmission(Signup, data)` adapter. That would make handlers choose between two safe parsing calls for the same schema and split submission handling across packages. The `fd.object` schema already knows logical and submitted names, control kinds, and which values are sensitive or files. `packages/data-schema/src/lib/form.ts` now validates once and constructs the failure result there; `ui/form` imports that plain-data contract for rendering. Dependencies continue to flow from UI to data-schema.

Core `s.parseSafe` remains generic Standard Schema parsing, including when it receives a form schema. It runs the form schema's decoding and validation but returns ordinary issues-only failures; it does not add restoration data. The `fd.object` descriptions identify missing checkboxes and sensitive entries for form-aware failures without changing ordinary `s.object` parsing. Scalar fields opt into sensitivity with `{ sensitive: true }`, independently of their control kind; passwords are always sensitive. Those failures omit sensitive and file values and project issues to messages and logical paths without raw input metadata. Successful parsing still returns validated sensitive values. Failed results retain other submitted values, so applications must treat them as request data and avoid putting secrets into authored error messages.

## Native constraints remain primary

The browser's Constraint Validation API owns native submission blocking. `control(field)` derives SSR constraints and checks native validity before running the shared scalar decoder and schema. Schema failures use `setCustomValidity`. `getConstraints()` remains available for custom integrations.

Without JavaScript, native constraints and server validation still work. Failed responses render errors and restore supported values; feedback timing and browser tooltips may differ from hydrated forms.

## Context owns feedback; applications own markup

`form.Context` scopes one rendered instance and supplies stable typed bindings. `root`, `control`, `label`, and `error` follow the same role-mixin pattern as other UI primitives. Field bindings pass through ordinary component props. Context updates rerender descendant feedback without setup factories, subscriptions, notification callbacks, or an internal emitter.

The component runtime preserves client-entry handle IDs across hydration, while nested local components receive new IDs. Context accepts an initial `id` scope so an entry can pass `handle.id` and retain exact server associations without new runtime infrastructure.

Client errors become visible after blur or native invalid submission. Server errors appear immediately and are replaced on editing. Non-canceled native reset clears feedback after defaults restore. Sensitive controls clear on failed submissions, while live edits survive ordinary rerenders. Single selects use the component renderer’s `defaultValue` handling to render selected options and update native reset defaults. A new submission identity refreshes failed values; ordinary rerenders preserve edits. Changing schemas requires a keyed remount.

Radio groups share one text binding. UI reads the selected enabled option in the native form/name group and coordinates validity across its members. Option values scope control IDs, and `label(field, value)` associates each option's label. File bindings validate selected files with the original schema, infer `multiple` from `files`, and clear selections on failed submissions. Native control capabilities determine projected constraints; date/time bounds remain authored markup. Hidden and action inputs cannot participate in client constraint validation, so handlers remain authoritative.

We reused `fd.fields` for multiple selects and same-name checkbox groups because both submit arrays of strings. Collection validation receives `[]` for no selection. Checkbox groups share feedback and option-scoped labels, without per-option `required` attributes that would require every checkbox. The component renderer supports array select values and defaults so SSR, hydration, and native reset use the same selection contract. Repeated free-text controls and indexed field arrays remain application-owned.

## Shared messages and application checks

Field-level `errorMap` uses schema/domain codes on server and client. Native-only constraints keep browser messages. Explicit schema messages retain precedence. `setCustomErrors()` adds current-value supplemental messages while applications retain async orchestration, cancellation, stale-result handling, and authoritative server checks.

Root refinements/transforms do not retain the inspectable form contract. Cross-field business checks remain explicit in handlers; scalar refinements and transforms work normally. Revisit root-rule preservation, standalone validation, custom widgets, and field arrays when concrete workflows establish their contracts.

See the [form guide](https://github.com/remix-run/remix/blob/main/packages/ui/src/form/README.md) and [bookstore demo](https://github.com/remix-run/remix/tree/main/demos/bookstore).
