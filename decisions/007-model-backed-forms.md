# Form schemas with native validation and context-scoped feedback

One inspectable form schema connects transport decoding, ordinary validation, and native UI behavior. `data-schema/form` owns the submission contract; `ui/form` consumes it through a Context and small role mixins. Applications keep control over markup and request handling.

## Form schemas describe submissions

`fd.object({ email: fd.text(Account.shape.email) })` reuses domain rules without another UI definition. A separate domain schema is optional; inline rules and fields from multiple models work the same way. Only configured fields are parsed. Handlers supply generated values, run business checks, and select values for persistence.

Explicit `text`, `password`, `number`, and `checkbox` descriptions identify transport semantics without inspecting DOM input types or changing ordinary `s.object` parsing. They normalize absence and blanks before running the original schema. The schema exposes `parse` and form-aware `parseSafe` methods that reuse core validation, options, messages, and inferred transforms. The existing `data-schema/form-data` adapter retains its lower-level extraction behavior.

Readonly `.entries` preserves original scalar schemas and decoding metadata for adapters. Form kinds and sensitivity belong here; labels, IDs, ARIA, feedback, and browser validity flags remain in UI. Package dependencies flow from UI to data-schema.

## Native constraints remain primary

The browser's Constraint Validation API owns native submission blocking. `control(field)` derives SSR constraints and checks native validity before running the shared scalar decoder and schema. Schema failures use `setCustomValidity`. `getConstraints()` remains available for custom integrations.

Without JavaScript, native constraints and server validation still work. `Signup.parseSafe()` and `fd.parseSafe(Signup, data)` delegate shared parsing once and extend failed results with restorable values and grouped errors, omitting password/file values and arbitrary issue metadata. The result types and their construction belong to `data-schema/form`. UI consumes this plain-data contract. Core `s.parseSafe` retains its ordinary issues-only failure contract.

## Context owns feedback; applications own markup

`form.Context` scopes one rendered instance and supplies stable typed bindings. `root`, `control`, `label`, and `error` follow the same role-mixin pattern as other UI primitives. Field bindings pass through ordinary component props. Context updates rerender descendant feedback without setup factories, subscriptions, notification callbacks, or an internal emitter.

The component runtime preserves client-entry handle IDs across hydration, while nested local components receive new IDs. Context accepts an initial `id` scope so an entry can pass `handle.id` and retain exact server associations without new runtime infrastructure.

Client errors become visible after blur or native invalid submission. Server errors appear immediately and are replaced on editing. Non-canceled native reset clears feedback after defaults restore. A new submission identity refreshes failed values; ordinary rerenders preserve edits. Changing schemas requires a keyed remount.

## Shared messages and application checks

Field-level `errorMap` uses schema/domain codes on server and client. Native-only constraints keep browser messages. Explicit schema messages retain precedence. `setCustomErrors()` adds current-value supplemental messages while applications retain async orchestration, cancellation, stale-result handling, and authoritative server checks.

Root refinements/transforms do not retain the inspectable form contract. Cross-field business checks remain explicit in handlers; scalar refinements and transforms work normally. Revisit root-rule preservation, standalone validation, custom widgets, and field arrays when concrete workflows establish their contracts.

See the [form guide](https://github.com/remix-run/remix/blob/main/packages/ui/src/form/README.md) and [form demo](https://github.com/remix-run/remix/tree/main/demos/data-model-forms).
