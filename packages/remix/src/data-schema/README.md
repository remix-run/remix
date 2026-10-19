# data-schema

Tiny, standards-aligned data validation for Remix and the wider TypeScript ecosystem.

- [Standard Schema](https://standardschema.dev/) v1 compatible
- Sync-first, minimal API surface
- Runs anywhere JavaScript runs (browser, Node.js, Bun, Deno, Workers)

## Quick start

```ts
import { enum_, literal, number, object, parse, string, variant } from 'remix/data-schema'
import { email, maxLength, min, minLength } from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'

let User = object({
  id: string(),
  email: string().pipe(email()),
  username: string().pipe(minLength(3), maxLength(20)),
  age: coerce.number().pipe(min(13)),
  role: enum_(['admin', 'member', 'guest']),
  flags: object({
    beta: coerce.boolean(),
  }),
})

let Event = variant('type', {
  created: object({ type: literal('created'), id: string() }),
  updated: object({ type: literal('updated'), id: string(), version: number() }),
})

let user = parse(User, {
  id: 'u1',
  email: 'ada@example.com',
  username: 'ada',
  age: '37',
  role: 'admin',
  flags: { beta: 'true' },
})

let event = parse(Event, { type: 'created', id: 'evt_1' })
```

## Parsing

Use `parse()` when you want a typed value or an exception.

```ts
import { object, string, number, parse } from 'remix/data-schema'

let User = object({ name: string(), age: number() })

let user = parse(User, { name: 'Ada', age: 37 })
```

Use `parseSafe()` when you prefer explicit branching over exceptions.

```ts
import { object, string, number, parseSafe } from 'remix/data-schema'

let User = object({ name: string(), age: number() })

let result = parseSafe(User, input)

if (!result.success) {
  // result.issues — array of { message, path? }
} else {
  let user = result.value
}
```

Both `parse` and `parseSafe` accept any [Standard Schema](https://standardschema.dev/) v1 schema, not just data-schema's own schemas. You can pass a Zod, Valibot, or ArkType schema and they'll work.

For `FormData` and `URLSearchParams`, use the `remix/data-schema/form-data` helpers to build schemas that plug into the same `parse()` / `parseSafe()` flow:

```ts
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as checks from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'

let Login = f.object({
  email: f.field(coerce.string().pipe(checks.email())),
  password: f.field(s.string().pipe(checks.minLength(8))),
})

let credentials = s.parse(Login, await request.formData())
let filters = s.parse(
  f.object({
    query: f.field(s.defaulted(s.string(), '')),
    tags: f.fields(s.array(s.string())),
  }),
  new URL(request.url).searchParams,
)
```

`f.object(...)` is the root schema for `FormData` and `URLSearchParams`. Use `f.field(...)` for one text value, `f.fields(...)` for repeated text values, `f.file(...)` for one uploaded file, and `f.files(...)` for repeated files. When you want a fallback value, prefer `s.defaulted(s.string(), '')`. File helpers are intended for `FormData`; `URLSearchParams` only supports text values.

## Native constraints

Use `getConstraints()` to derive native HTML length and range attributes from recognized schema checks:

```tsx
import { getConstraints, string } from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'

let Username = string().pipe(minLength(3), maxLength(20))

<input {...getConstraints(Username, { type: 'text' })} />
// <input required minlength="3" maxlength="20" />
```

The input type supplies the control-specific requiredness and numeric step behavior. Checks without an equivalent native constraint are omitted.

## Model-backed forms

Use `createForm()` to select fields from object schemas, attach UI-only metadata, derive native input constraints, and decode submitted `FormData` with the original field schemas. Only configured fields are validated; omitted model fields are not required. Cross-field rules belong in a separate handler step.

**Single schema:** select model fields without repeating their validation rules.

```ts
import * as s from 'remix/data-schema'
import { email, max, maxLength, min, minLength } from 'remix/data-schema/checks'
import { createForm } from 'remix/data-schema/form'

let Account = s.object({
  id: s.string(),
  email: s.string().pipe(email()),
  displayName: s.string().pipe(minLength(2), maxLength(50)),
  age: s.number().pipe(min(13), max(120)),
})

let ProfileForm = createForm({
  schema: Account,
  fields: {
    email: { label: 'Email', type: 'email' },
    displayName: { label: 'Display name', type: 'text' },
  },
})
```

**Partial inline:** reuse model fields and add request-only fields with their own schemas.

```ts
let AccountForm = createForm({
  schema: Account,
  fields: {
    email: { label: 'Email', type: 'email' },
    displayName: { label: 'Display name', type: 'text' },
    age: { label: 'Age', type: 'number' },
    terms: {
      label: 'Accept the terms',
      type: 'checkbox',
      schema: s.literal(true),
    },
  },
})
```

**Multiple schemas:** compose a form-specific object from existing field schemas. The `.shape` property exposes the fields passed to `s.object()`.

```ts
let Address = s.object({ postalCode: s.string().pipe(minLength(1)) })
let Checkout = s.object({
  email: Account.shape.email,
  postalCode: Address.shape.postalCode,
})

let CheckoutForm = createForm({
  schema: Checkout,
  fields: {
    email: { label: 'Email', type: 'email' },
    postalCode: { label: 'Postal code', type: 'text' },
  },
})
```

**Entirely inline:** omit `schema` and give every field its own schema. Fields absent from a backing schema must supply a schema; model fields cannot override theirs.

```ts
let LoginForm = createForm({
  fields: {
    email: { label: 'Email', type: 'email', schema: s.string().pipe(email()) },
    password: {
      label: 'Password',
      type: 'password',
      schema: s.string().pipe(minLength(8)),
    },
  },
})
```

All four variations use the same parsing and rendering APIs below. A form can collect values for multiple tables; the handler splits the parsed values and coordinates persistence.

### Reusable fields

`createField()` defines one field without form or browser state. It can parse independently or compose into a form:

```ts
import { createField } from 'remix/data-schema/form'

let Email = createField({ schema: Account.shape.email, label: 'Email', type: 'email' })
let result = Email.parse(await request.formData(), 'email')

let ContactForm = createForm({ fields: { email: Email } })
```

`Email.required`, `getInputAttrs(name, submission?)`, `getLabelAttrs(name)`, `getErrorAttrs(name)`, and `createInputValidator(name?)` are available independently. The logical name is supplied when parsing or binding, so one definition can be reused under different names. Explicit `name` and `id` options override native attributes, not the logical keys in submission results. `createForm()` resolves each configured field through this same field layer and exposes the definitions through `Form.fields`.

Server handlers receive a typed value or a serializable failure containing the submitted values and grouped errors. Password values are deliberately omitted from failed results so they are not copied into action data or server-rendered HTML.

```tsx
let submission = AccountForm.parse(await request.formData())

if (!submission.success) {
  return render(<AccountPage submission={submission} />, { status: 400 })
}

await createAccount(submission.value)
```

The same form definition produces low-level attribute bags. Markup and styling remain application-owned, while `@remix-run/ui/form` supplies the small progressive enhancement for touched state:

```tsx
import type { FormFailure } from 'remix/data-schema/form'
import type { Handle } from 'remix/component'
import { createFormMixins } from '@remix-run/ui/form'

function AccountPage(handle: Handle<{ submission?: FormFailure }>) {
  let { form, input, label, error, errors } = createFormMixins(AccountForm, {
    getSubmission: () => handle.props.submission,
    onChange: () => handle.update(),
  })

  return () => (
    <form method="post" mix={form()}>
      <label mix={label('email')}>
        {AccountForm.fields.email.label}
        {AccountForm.fields.email.required ? <span>Required</span> : null}
      </label>
      <input autoComplete="email" mix={input('email')} />
      {errors.email.length > 0 ? (
        <p mix={error('email')} role="alert">
          {errors.email.join(' ')}
        </p>
      ) : null}

      <label>
        <input mix={input('terms')} />
        {AccountForm.fields.terms.label}
      </label>
      {errors.terms.length > 0 ? (
        <p mix={error('terms')} role="alert">
          {errors.terms.join(' ')}
        </p>
      ) : null}

      <button type="submit">Create account</button>
    </form>
  )
}
```

The browser blocks invalid submissions with the Constraint Validation API even when JavaScript is disabled. Call `createFormMixins(AccountForm, { getSubmission, onChange })` once in component setup; its control mixins apply native constraints during SSR and supplement native validation with synchronous schema issues through `setCustomValidity()`. Live `fields.email.errors/touched` properties expose feedback, while `label(field)` associates the label and `error(field)` supplies the error-element id. `onChange` requests rendering when messages or touched state changes. `createFieldMixins(Email, { name, getSubmission, onChange })` supplies the same behavior independently for one input, select, or textarea. New submissions reset feedback automatically. Do not add `noValidate` unless intentionally opting out of native validation.

The first release maps field-level `required`, `minLength`, `maxLength`, `min`, and `max` constraints to native attributes. Other synchronous field refinements can use `createInputValidator()` for client-side feedback and still run authoritatively during server parsing. Whole-object, cross-field, and asynchronous form rules are not part of the projection yet and should be applied in the server handler.

You can also customize built-in validation messages with `errorMap`:

```ts
import { object, parseSafe, string } from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'

let User = object({
  name: string(),
  username: string().pipe(minLength(3)),
})
let result = parseSafe(User, input, {
  locale: 'es',
  errorMap(context) {
    if (context.code === 'type.string') {
      return 'Se esperaba texto'
    }

    if (context.code === 'string.min_length') {
      return (
        'Debe tener al menos ' + String((context.values as { min: number }).min) + ' caracteres'
      )
    }
  },
})
```

`errorMap` receives `{ code, defaultMessage, path, values, input, locale }`. Return `undefined` to keep the default message.

## Primitives

```ts
import { string, number, boolean, bigint, symbol, null_, undefined_ } from 'remix/data-schema'

string() // validates typeof === 'string'
number() // validates finite numbers (rejects NaN, Infinity)
boolean() // validates typeof === 'boolean'
bigint() // validates typeof === 'bigint'
symbol() // validates typeof === 'symbol'
null_() // validates value === null
undefined_() // validates value === undefined
```

## Literals, enums, and unions

```ts
import { literal, enum_, union } from 'remix/data-schema'

// Exact value match
let yes = literal('yes')

// One of several allowed values
let Status = enum_(['active', 'inactive', 'pending'])

// First schema that matches wins
let StringOrNumber = union([string(), number()])
```

## Objects

```ts
import { object, string, number, optional, defaulted } from 'remix/data-schema'

let User = object({
  name: string(),
  bio: optional(string()), // accepts undefined
  role: defaulted(string(), 'user'), // fills in 'user' when undefined
  age: number(),
})
```

Unknown keys are stripped by default. Change this with `unknownKeys`:

```ts
object({ name: string() }, { unknownKeys: 'passthrough' }) // keeps unknown keys
object({ name: string() }, { unknownKeys: 'error' }) // rejects unknown keys
```

## Collections

```ts
import { array, tuple, record, map, set, string, number, boolean } from 'remix/data-schema'

array(number()) // number[]
tuple([string(), number(), boolean()]) // [string, number, boolean]
record(string(), number()) // Record<string, number>
map(string(), number()) // Map<string, number>
set(number()) // Set<number>
```

## Modifiers

```ts
import { nullable, optional, defaulted, string, number } from 'remix/data-schema'

nullable(string()) // string | null
optional(number()) // number | undefined
defaulted(string(), 'n/a') // fills 'n/a' when undefined
```

## Instance checks

```ts
import { instanceof_, object } from 'remix/data-schema'

let Schema = object({
  created: instanceof_(Date),
  pattern: instanceof_(RegExp),
})
```

## Any

Accept any value without validation. Useful when part of a structure is opaque.

```ts
import { any, object, string } from 'remix/data-schema'

let Envelope = object({
  type: string(),
  payload: any(),
})
```

## Custom rules with `.refine()`

Add domain-specific validation logic inline. The predicate runs after the schema validates.

```ts
import { number, string, object } from 'remix/data-schema'

let Profile = object({
  username: string().refine((s) => s.length >= 3, 'Too short'),
  age: number().refine((n) => n >= 18, 'Must be an adult'),
})
```

## Output transforms with `.transform()`

Map a validated value into the shape your app wants. The transformer runs after the schema validates and changes the parsed output type.

```ts
import { object, parse, string } from 'remix/data-schema'

let Event = object({
  id: string(),
  createdAt: string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Expected valid date')
    .transform((value) => new Date(value)),
})

let event = parse(Event, {
  id: 'evt_1',
  createdAt: '2026-04-25T00:00:00.000Z',
})

event.createdAt // Date
```

Use `.refine()` for checks that reject values without changing them. Use `.transform()` for safe, synchronous mappings; thrown errors are propagated instead of converted into validation issues.

## Validation pipelines with `.pipe()`

Compose reusable `Check` objects for common constraints.

```ts
import { object, string, number } from 'remix/data-schema'
import { minLength, maxLength, email, min, max } from 'remix/data-schema/checks'

let Credentials = object({
  username: string().pipe(minLength(3), maxLength(20)),
  email: string().pipe(email()),
  age: number().pipe(min(13), max(130)),
})
```

Built-in checks: `minLength`, `maxLength`, `email`, `url`, `min`, `max`.

## Coercing input values

Turn stringly-typed inputs (like form data or query strings) into real types at the schema boundary.

```ts
import { object, parse } from 'remix/data-schema'
import * as coerce from 'remix/data-schema/coerce'

let Query = object({
  page: coerce.number(),
  includeArchived: coerce.boolean(),
  since: coerce.date(),
  limit: coerce.bigint(),
  search: coerce.string(),
})

let query = parse(Query, {
  page: '2',
  includeArchived: 'true',
  since: '2025-01-01',
  limit: '100',
  search: 42,
})
```

## Discriminated unions

Pick the right schema based on a discriminator property.

```ts
import { literal, number, object, string, variant } from 'remix/data-schema'

let Event = variant('type', {
  created: object({ type: literal('created'), id: string() }),
  updated: object({ type: literal('updated'), id: string(), version: number() }),
})
```

## Recursive schemas

Model trees and self-referencing structures. `lazy()` defers schema resolution to avoid circular references.

```ts
import { array, object, string } from 'remix/data-schema'
import { lazy } from 'remix/data-schema/lazy'
import type { Schema } from 'remix/data-schema'

type TreeNode = { id: string; children: TreeNode[] }

let Node: Schema<unknown, TreeNode> = lazy(() => object({ id: string(), children: array(Node) }))
```

## Aborting early

By default, validation collects all issues in a single pass. To stop at the first issue, enable `abortEarly`.

```ts
import { object, string, number, parseSafe } from 'remix/data-schema'

let result = parseSafe(
  object({ name: string(), age: number() }),
  { name: 123, age: 'x' },
  { abortEarly: true },
)

if (!result.success) {
  console.log(result.issues) // only the first issue
}
```

## Type inference

Extract input and output types from any Standard Schema-compatible schema.

```ts
import { object, string, number } from 'remix/data-schema'
import type { InferInput, InferOutput } from 'remix/data-schema'

let User = object({ name: string(), age: number() })

type UserInput = InferInput<typeof User> // unknown
type UserOutput = InferOutput<typeof User> // { name: string; age: number }
```

## Extending data-schema

Build custom schemas using `createSchema`, `createIssue`, and `fail`. These are the same primitives used internally by every built-in schema.

```ts
import { createSchema, createIssue, fail } from 'remix/data-schema'
import type { Schema } from 'remix/data-schema'

// A schema that validates a non-empty trimmed string
function trimmedString(): Schema<unknown, string> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'string') {
      return fail('Expected string', context.path)
    }

    let trimmed = value.trim()

    if (trimmed.length === 0) {
      return fail('Expected non-empty string', context.path)
    }

    return { value: trimmed }
  })
}

// A schema that validates a [lat, lng] coordinate pair
function latLng(): Schema<unknown, [number, number]> {
  return createSchema(function validate(value, context) {
    if (!Array.isArray(value) || value.length !== 2) {
      return fail('Expected [lat, lng] pair', context.path)
    }

    let issues = []
    let [lat, lng] = value

    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      issues.push(createIssue('Latitude must be between -90 and 90', [...context.path, 0]))
    }

    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      issues.push(createIssue('Longitude must be between -180 and 180', [...context.path, 1]))
    }

    if (issues.length > 0) {
      return { issues }
    }

    return { value: [lat, lng] }
  })
}
```

The validator function receives the raw value and a context with the current `path` and `options`. Return `{ value }` on success or `{ issues: [...] }` on failure. The returned schema is fully Standard Schema v1-compatible and supports `.pipe()` and `.refine()` out of the box.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
