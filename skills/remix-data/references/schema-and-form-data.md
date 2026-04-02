# Schema and Form Data

Use `remix/data-schema` for validation and parsing, and `remix/data-schema/form-data` for decoding
`FormData` and `URLSearchParams` into typed values at the request boundary.

## Import Convention

```ts
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength, maxLength, email, min, max } from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'
```

## Parsing

Use `s.parse(schema, input)` when you want a typed value or an exception:

```ts
let user = s.parse(UserSchema, input)
```

Use `s.parseSafe(schema, input)` when you prefer explicit branching:

```ts
let result = s.parseSafe(UserSchema, input)
if (!result.success) {
  // result.issues — array of { message, path? }
} else {
  let user = result.value
}
```

Both accept any [Standard Schema](https://standardschema.dev/) v1 schema, including Zod, Valibot,
or ArkType.

## Primitives and Modifiers

```ts
s.string()
s.number()
s.boolean()
s.optional(s.string())      // string | undefined
s.nullable(s.string())      // string | null
s.defaulted(s.string(), '') // falls back to '' when undefined
s.enum_(['admin', 'customer'])
s.literal('yes')
s.array(s.number())
s.object({ name: s.string(), age: s.number() })
```

## Checks

Compose reusable constraints with `.pipe(...)`:

```ts
let Username = s.string().pipe(minLength(3), maxLength(20))
let Email = s.string().pipe(email())
let Age = s.number().pipe(min(13), max(130))
```

Built-in checks: `minLength`, `maxLength`, `email`, `url`, `min`, `max`.

## Coercion

Turn string inputs into typed values at the schema boundary:

```ts
coerce.number()   // '42' → 42
coerce.boolean()  // 'true' → true, '' → false
coerce.date()     // '2025-01-01' → Date
coerce.string()   // 42 → '42'
```

Use `coerce.boolean()` for HTML checkbox fields, which submit `'on'` or are absent.

## Form Data Schemas

Use `f.object(...)` as the root schema for `FormData` or `URLSearchParams`. Use `f.field(...)` for
single text values, `f.fields(...)` for repeated values, `f.file(...)` for a single upload, and
`f.files(...)` for multiple uploads:

```ts
let BookSchema = f.object({
  title: f.field(s.defaulted(s.string(), '')),
  author: f.field(s.defaulted(s.string(), '')),
  price: f.field(s.defaulted(s.string(), '0')),
  inStock: f.field(s.defaulted(coerce.boolean(), false)),
  tags: f.fields(s.array(s.string())),
})

let book = s.parse(BookSchema, formData)
```

For URL search params:

```ts
let Filters = f.object({
  query: f.field(s.defaulted(s.string(), '')),
  page: f.field(s.defaulted(coerce.number(), 1)),
})

let filters = s.parse(Filters, new URL(request.url).searchParams)
```

### Field Name Mapping

When the form field name differs from the output key, pass a `name` option:

```ts
let publishedYearField = f.field(s.defaulted(s.string(), '2024'), {
  name: 'publishedYear',
})
```

## Custom Schemas

Build domain-specific schemas with `createSchema`, `createIssue`, and `fail`:

```ts
import { createSchema, fail } from 'remix/data-schema'

function trimmedString() {
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
```

## Inline Refinement

Use `.refine(...)` for one-off domain checks:

```ts
let PositivePrice = s.number().refine((n) => n > 0, 'Price must be positive')
```

## Error Maps

Customize validation messages per locale:

```ts
let result = s.parseSafe(schema, input, {
  locale: 'es',
  errorMap(context) {
    if (context.code === 'type.string') return 'Se esperaba texto'
  },
})
```

## Discriminated Unions

Pick the right schema based on a discriminator property:

```ts
let Event = s.variant('type', {
  created: s.object({ type: s.literal('created'), id: s.string() }),
  updated: s.object({ type: s.literal('updated'), id: s.string(), version: s.number() }),
})
```

## Controller Pattern

A simple form submission handler that throws on invalid input:

```ts
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength } from 'remix/data-schema/checks'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'
import { users } from '../../data/schema.ts'

const registrationSchema = f.object({
  name: f.field(s.defaulted(s.string(), '')),
  email: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.string().pipe(minLength(8))),
})

async function action({ get }) {
  let db = get(Database)
  let formData = get(FormData)
  let { email, name, password } = s.parse(registrationSchema, formData)

  await db.create(users, {
    email: email.trim().toLowerCase(),
    password_hash: await hashPassword(password),
    name,
  })

  return redirect('/account')
}
```

## Form Submission With Error Re-Rendering

When a form should re-render with errors instead of throwing, use `parseSafe`, coercion, custom
schemas, and cross-field checks:

```ts
import * as s from 'remix/data-schema'
import { createSchema, fail } from 'remix/data-schema'
import { min, max } from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'
import * as f from 'remix/data-schema/form-data'

const trimmedNonEmpty = createSchema(function validate(value, context) {
  if (typeof value !== 'string') return fail('This field is required', context.path)
  let trimmed = value.trim()
  if (!trimmed) return fail('This field is required', context.path)
  return { value: trimmed }
})

const optionalBoundedInt = createSchema(function validate(value, context) {
  if (value === '' || value == null) return { value: null }
  let num = Number.parseInt(String(value), 10)
  if (!Number.isFinite(num) || num < 1 || num > 5) {
    return fail('Must be between 1 and 5', context.path)
  }
  return { value: num }
})

const itemSchema = f.object({
  name: f.field(trimmedNonEmpty),
  quantity: f.field(coerce.number().pipe(min(1))),
  rating: f.field(optionalBoundedInt),
})

const fieldLabels: Record<string, string> = {
  name: 'Name',
  quantity: 'Quantity',
  rating: 'Rating',
}
```

Parse with `parseSafe`, capture raw form values for re-rendering, and check cross-field constraints
after the schema validates individual fields:

```ts
function parseItemForm(formData: FormData) {
  let rawValues: Record<string, string> = {}
  for (let key of ['name', 'quantity', 'rating']) {
    rawValues[key] = (formData.get(key) as string) ?? ''
  }

  let result = s.parseSafe(itemSchema, formData)
  if (!result.success) {
    let errors = result.issues.map((issue) => {
      let field = issue.path?.[0]
      let label = typeof field === 'string' ? fieldLabels[field] : undefined
      return label ? `${label}: ${issue.message}` : issue.message
    })
    return { success: false as const, errors, rawValues }
  }

  return { success: true as const, input: result.value }
}
```

Use the helper in actions to keep them thin:

```ts
async action({ get }) {
  let formData = get(FormData)
  let parsed = parseItemForm(formData)

  if (!parsed.success) {
    let scripts = await getDocumentScripts()
    return render(
      <FormPage scripts={scripts} errors={parsed.errors} values={parsed.rawValues} />,
      { status: 422 },
    )
  }

  await db.create(items, parsed.input)
  return redirect('/items')
}
```
