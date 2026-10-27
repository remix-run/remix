# Form schemas

Describe native form inputs once, then use ordinary schema parsing on `FormData` or `URLSearchParams`.

```ts
import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'
import { email, min, minLength } from 'remix/data-schema/checks'

export const Signup = fd.object({
  email: fd.text(s.string().pipe(email())),
  password: fd.password(s.string().pipe(minLength(8))),
  age: fd.number(s.optional(s.number().pipe(min(0)))),
  terms: fd.checkbox(s.literal(true)),
})

let result = Signup.parseSafe(await request.formData())
if (result.success) await createAccount(result.value)
```

`Signup.parse(data)` returns validated output or throws `ValidationError`. `Signup.parseSafe(data)` returns `{ success: true, value }` or a failure with `success: false`, `issues`, `values`, and grouped `errors.fields` / `errors.form`. Both accept ordinary parse options and preserve error-map precedence and inferred transforms. Validation runs once, after form decoding.

On failure, `values` retains raw text, number text, checkbox states, and repeated text for restoration. Passwords and files are omitted. Issues retain messages and logical paths; raw inputs and arbitrary metadata are omitted. Application-authored messages must avoid embedding secrets. Invalid source inputs produce a form-level failure with empty restoration values.

The functional calls `fd.parse(Signup, data)` and `fd.parseSafe(Signup, data)` are also available. `fd.parse` re-exports the ordinary throwing parser; `fd.parseSafe` adds the same form failure adaptation as the schema method. The form object implements Standard Schema, so `s.parse` and `s.parseSafe` also work with it and keep their ordinary contracts. Core `s.parseSafe` does not add restoration data or project issues. The instance parsing methods belong to `fd.object()`; ordinary schemas retain their existing functional API.

## Reuse domain rules

A separate domain schema is optional. When one exists, reuse its fields:

```ts
let Profile = fd.object({
  email: fd.text(Account.shape.email),
  age: fd.number(Account.shape.age),
})
```

The submission schema selects accepted fields and their transport behavior. It can omit generated IDs, combine fields from multiple models, and include request-only fields. Labels, layout, and presentation types such as `email` remain in markup.

## Missing and empty entries

| Helper              | Missing     | Empty string                      | Other text                      |
| ------------------- | ----------- | --------------------------------- | ------------------------------- |
| `text(schema)`      | `undefined` | `undefined`                       | Preserved exactly               |
| `password(schema)`  | `undefined` | `undefined`                       | Preserved exactly               |
| `number(schema)`    | `undefined` | `undefined`, including whitespace | Existing finite-number coercion |
| `checkbox(schema?)` | `false`     | `true`                            | `true`                          |

The supplied schema decides whether the decoded value is valid. Use `s.optional()` or `s.defaulted()` to accept blanks. Invalid nonblank numeric text fails instead of using a default; `"0"` becomes `0`. Text and passwords are never trimmed. Use `fd.text(schema, { empty: 'preserve' })` or the same option on `password` to retain `''`.

`checkbox()` uses a boolean schema by default. `checkbox(s.literal(true))` requires agreement. Any present text value, including `"false"`, means checked. An unchecked checkbox stays `false`, so an undefined-only default does not make it checked. Files supplied to scalar text helpers are rejected. Scalars read the first entry.

## Names, messages, repeated values, and files

```ts
let Settings = fd.object({
  email: fd.text(Account.shape.email, {
    name: 'account.email',
    errorMap({ code }) {
      if (code === 'value.required') return 'Enter your email'
    },
  }),
  tags: fd.fields(s.array(s.string())),
  avatar: fd.file(s.optional(s.instanceof_(Blob))),
  attachments: fd.files(s.array(s.instanceof_(Blob))),
})
```

Issues use logical keys such as `email`, independently of transport names. Field error maps compose with parse options; explicit schema messages keep precedence. Repeated text defaults to `[]`. `fields`, `file`, and `files` reuse the existing FormData extraction helpers.

The lower-level `remix/data-schema/form-data` export stays available with its existing semantics, including `field()` preserving empty strings. Choose it when you only need explicit extraction without native form kinds or empty-value normalization.

## UI adapters

Form objects expose readonly `.entries` with the original scalar schemas, kinds, names, and decoding options. `isFormField()` distinguishes scalar entries; `validateField()` applies the same decoding and validation to an individual control value.

`password` returns validated passwords normally on success. Pass a failed `Signup.parseSafe(data)` result directly to [`form.Context`](https://github.com/remix-run/remix/blob/main/packages/ui/src/form/README.md). This module owns the `FormSubmission`, `FormErrors`, and parsing-result types; UI imports them without a reverse dependency. Handlers can also construct a `FormSubmission` for business failures.

`form.Context` accepts the inspectable `fd.object()` result. Root refinements/transforms produce general schemas without that inspection contract; keep cross-field business checks in the handler. Scalar refinements and transforms are supported.
