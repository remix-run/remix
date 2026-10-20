# Data model forms demo

Four routes show schema-backed native forms connected to in-memory SQLite. Each keeps labels, controls, and error markup under application control.

## Run it

From the repository root:

```sh
pnpm install
pnpm -C demos/data-model-forms dev
```

Open <http://localhost:44100>. The root redirects to `/schema`; navigation links connect all four examples.

## Examples

| Route           | Definition                             | Binding               |
| --------------- | -------------------------------------- | --------------------- |
| `/schema`       | Object schema + `createForm()`         | `createFormMixins()`  |
| `/fields`       | Individual `createField()` definitions | `createFieldMixins()` |
| `/extra-fields` | Object schema + request-only fields    | `createFormMixins()`  |
| `/inline`       | All schemas inline in `createForm()`   | `createFormMixins()`  |

### One object schema

[Schema example source](https://github.com/remix-run/remix/tree/main/demos/data-model-forms/app/actions/schema)

```ts
const AccountForm = createForm({
  schema: Account,
  fields: {
    displayName: { label: 'Display name', type: 'text' },
    email: { label: 'Email address', type: 'email' },
    age: { label: 'Age', type: 'number' },
    website: { label: 'Website', type: 'url' },
  },
})
```

The form reuses the account model's field rules and omits the server-owned `id`. Parsing validates only configured fields, not whole-object refinements.

### Individual fields

[Independent fields source](https://github.com/remix-run/remix/tree/main/demos/data-model-forms/app/actions/fields)

```ts
const Email = createField({
  schema: EmailSchema,
  label: 'Email address',
  type: 'email',
})

let email = createFieldMixins(Email, {
  name: 'email',
  getSubmission: () => handle.props.submission,
  onChange: () => handle.update(),
})
```

The UI uses `email.field()`, `email.label()`, `email.error()`, `email.errors`, and `email.touched`. No form binding is needed. The handler parses each field and combines failures; both schemas are also reused by the persisted account schema.

### Schema plus extra fields

[Extra-fields source](https://github.com/remix-run/remix/tree/main/demos/data-model-forms/app/actions/extra-fields)

```ts
const RegistrationForm = createForm({
  schema: Account,
  fields: {
    displayName: { label: 'Display name', type: 'text' },
    email: { label: 'Email address', type: 'email' },
    password: Password,
    terms: {
      label: 'I agree to the terms of service',
      type: 'checkbox',
      schema: s.literal(true),
    },
  },
})
```

The reusable `Password` field is created with `createField()`. Password and terms are validated but never stored. Passwords are also omitted from failed-submission values.

Display name, password, and terms use field-level `errorMap` configuration for shared browser/server messages. Display name covers requiredness, minimum length, and a whitespace refinement. Without JavaScript, native tooltips keep browser wording.

### All inline schemas

[Inline example source](https://github.com/remix-run/remix/tree/main/demos/data-model-forms/app/actions/inline)

```ts
const AccountForm = createForm({
  fields: {
    displayName: {
      label: 'Display name',
      type: 'text',
      schema: s.string().pipe(minLength(2)),
    },
    email: {
      label: 'Email address',
      type: 'email',
      schema: s.string().pipe(email()),
    },
  },
})
```

With no backing schema, every field supplies its own. The running example also checks maximum name length and leading/trailing spaces. Prefer shared model or field schemas when rules are reused.

## Shared behavior

Native constraints work before JavaScript loads. After hydration, mixins validate while typing, reveal feedback after blur or a blocked submission, and manage error accessibility. The UI reads live `errors` and `touched` state and reserves space for messages to avoid moving the action buttons.

Each form includes a client-only **Fill demo values** button. Add spaces around the display name and blur it to see a synchronous schema refinement rendered inline. With JavaScript disabled, submit `a@b` as the email: native email validation accepts it, but the server schema returns a populated form with a field error.

Successful POSTs redirect back to their example. Saved accounts are visible on every page until the process exits. The table validates writes with `Account`; controllers supply the id and select persisted fields. Cross-field rules remain a separate handler concern.

## Code layout

- Route-local controllers, pages, and definitions live under `app/actions/{schema,fields,extra-fields,inline}/`.
- Browser components and definitions live in each route's `public/` directory.
- `app/ui/example-page.tsx` shares navigation and the stored-account panel; `app/ui/public/styles.ts` shares styles.
- `app/data/public/account-schema.ts` contains schemas shared by browser validation and database writes.
- Controllers, table definitions, and SQLite setup stay outside the browser asset boundary.
- The render middleware supplies the document by default. Handlers can set `document: { title }`, pass `responseInit`, or use `document: false` for partial HTML.

## Verify it

```sh
pnpm -C demos/data-model-forms typecheck
```

This POC intentionally has no committed test suite.
