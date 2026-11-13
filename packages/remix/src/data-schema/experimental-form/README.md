# Form schemas

**Experimental:** APIs and behavior in this export may change or be removed in patch releases.

Describe native form inputs once, then use ordinary schema parsing on `FormData` or `URLSearchParams`.

```ts
import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/experimental/form'
import { email, min, minLength } from 'remix/data-schema/checks'

export const Signup = fd.object({
  email: fd.text(s.string().pipe(email())),
  password: fd.password(s.string().pipe(minLength(8))),
  age: fd.number(s.optional(s.number().pipe(min(0)))),
  terms: fd.checkbox(s.literal(true)),
})

let result = fd.parseSafe(Signup, await request.formData())
if (result.success) await createAccount(result.value)
```

`fd.parse(Signup, data)` returns validated output or throws `ValidationError`. `fd.parseSafe(Signup, data)` returns `{ success: true, value }` or a failure with `success: false`, `issues`, `values`, and grouped errors. `errors.fields` contains only fields with messages, and `errors.form` is absent when there are no form-level messages. Both functions accept ordinary parse options and preserve error-map precedence and inferred transforms. Validation runs once, after form decoding.

On failure, `values` retains raw text, number text, checkbox states, and repeated text for restoration. Sensitive fields and files are omitted; passwords are always sensitive. Issues retain messages and logical paths; raw inputs and arbitrary metadata are omitted. Application-authored messages must avoid embedding secrets. Invalid source inputs produce a form-level failure with empty restoration values.

Form objects implement Standard Schema, so core `s.parse` and `s.parseSafe` work with them too; core safe parsing keeps its ordinary failure contract without restoration data or issue projection. Neither ordinary nor form schemas exposes instance parsing methods.

## Persist submission feedback

Use the form's `submissionSchema` property to restore saved feedback from the same definition. The property creates the schema on first access and reuses it on subsequent accesses. Failed submissions are already JSON-safe, so storage can serialize them normally:

```ts
let result = fd.parseSafe(Signup, await request.formData())
if (!result.success) {
  let serialized = JSON.stringify(result)
  let restored = s.parse(Signup.submissionSchema, JSON.parse(serialized))
  // Persist the serialized value between requests, then pass restored to form.Context.
}
```

The derived schema returns a `FormSubmission` containing only `values` and `errors`. It accepts raw strings for text and number controls, booleans for checkboxes, and string arrays for repeated fields. Every restoration value is optional, including values for required inputs. Validation rules, defaults, refinements, transforms, and error maps from the original form are not run again; invalid input and application-authored messages are preserved.

Values and field errors use logical form keys, independently of transport name overrides. Unknown values, sensitive values, password values, files, and extra submission properties are stripped. Errors for sensitive and file fields remain available. Malformed feedback, incorrect raw value kinds, and errors for unknown fields are rejected. Application-authored messages must still avoid embedding secrets. Use ordinary `s.parseSafe()` when invalid or stale saved feedback should be discarded instead of throwing.

The derived schema also accepts application-created `FormSubmission` objects for business failures. It restores UI feedback rather than validated success output, which may contain files or transformed values that require application-specific serialization.

## Reuse domain rules

A domain schema is optional. Reuse its typed property schemas through the experimental inspection API:

```ts
import { getSchemaMetadata } from 'remix/data-schema/experimental'

let { shape } = getSchemaMetadata(Account)
let Profile = fd.object({
  email: fd.text(shape.email),
  age: fd.number(shape.age),
})
```

The experimental export may change or be removed in patch releases. The form schema selects submitted fields and their decoding; labels, layout, and presentation types stay in markup. String-valued controls, including radio and date/time inputs, use `fd.text`; number and range use `fd.number`. Date/time values stay strings unless the supplied schema transforms them.

## Missing and empty entries

| Helper              | Missing     | Empty string                      | Other text                      |
| ------------------- | ----------- | --------------------------------- | ------------------------------- |
| `text(schema)`      | `undefined` | `undefined`                       | Preserved exactly               |
| `password(schema)`  | `undefined` | `undefined`                       | Preserved exactly               |
| `number(schema)`    | `undefined` | `undefined`, including whitespace | Existing finite-number coercion |
| `checkbox(schema?)` | `false`     | `true`                            | `true`                          |

The supplied schema decides whether the decoded value is valid. Use `s.optional()` or `s.defaulted()` to accept blanks. Invalid nonblank numeric text fails instead of using a default; `"0"` becomes `0`. Text and passwords are never trimmed. Use `fd.text(schema, { empty: 'preserve' })` or the same option on `password` to retain `''`.

`checkbox()` uses a boolean schema by default. `checkbox(s.literal(true))` requires agreement. Any present text value, including `"false"`, means checked. An unchecked checkbox stays `false`, so an undefined-only default does not make it checked. Files supplied to scalar text helpers are rejected. Scalars read the first entry.

## Sensitive values

Set `sensitive: true` to omit a scalar field from failed-submission values without changing its input kind:

```ts
let Payment = fd.object({
  cardNumber: fd.text(cardNumberSchema, { sensitive: true }),
  cardholder: fd.text(s.string()),
})
```

Sensitivity affects failure restoration only; validated success values and field errors remain available. Passwords are always sensitive, even with `sensitive: false`. Custom error messages must avoid embedding secrets.

## Names, messages, repeated values, and files

```ts
let Settings = fd.object({
  email: fd.text(shape.email, { name: 'account.email' }),
  tags: fd.fields(s.array(s.string())),
  avatar: fd.file(s.optional(s.instanceof_(Blob))),
  attachments: fd.files(s.array(s.instanceof_(Blob))),
})
```

Issues use logical keys such as `email`, independently of transport names. Descriptor `errorMap` options compose with parse options; explicit schema messages keep precedence. An unnamed zero-byte File means no upload: `file` receives `undefined`, and `files` excludes it. Named zero-byte files remain valid inputs. The supplied schema decides whether a missing file or empty list is accepted. Files are never included in failed restoration values.

`fd.fields` reads all submitted strings in order, preserves blanks, and returns `[]` for no entries. It supports multiple selects and same-name checkbox groups; use array validation or refinements to require selections. `fd.checkbox` describes one boolean checkbox.

The lower-level `remix/data-schema/form-data` export stays available with its existing semantics, including `field()` preserving empty strings. Choose it when you only need explicit extraction without native form kinds or empty-value normalization.

## UI adapters

Form objects expose readonly `.entries` with the original scalar schemas, kinds, names, and decoding and sensitivity options. `isFormField()` distinguishes scalar entries; `validateField()` applies the same decoding and validation to an individual control value.

Pass a failed `fd.parseSafe(Signup, data)` result directly to [`form.Context`](https://github.com/remix-run/remix/blob/main/packages/ui/src/form/README.md). Handlers can also construct a `FormSubmission` for business failures.

`form.Context` accepts the inspectable `fd.object()` result. Root refinements/transforms produce general schemas without that inspection contract; keep cross-field business checks in the handler. Scalar refinements and transforms are supported.
