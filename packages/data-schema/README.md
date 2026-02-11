# data-schema

Tiny, standards-aligned data validation for Remix and the wider TypeScript ecosystem.

- [Standard Schema](https://standardschema.dev/) v1 compatible
- Sync-first, minimal API surface
- Runs anywhere JavaScript runs (browser, Node.js, Bun, Deno, Workers)

## Quick start

```ts
import { enum_, literal, number, object, parse, string, variant } from '@remix-run/data-schema'
import { email, maxLength, min, minLength } from '@remix-run/data-schema/checks'
import * as coerce from '@remix-run/data-schema/coerce'

let User = object({
  id: string(),
  email: string().pipe(email()),
  username: string().pipe(minLength(3), maxLength(20)),
  age: coerce.number().pipe(min(13)),
  role: enum_(['admin', 'member', 'guest'] as const),
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
import { object, string, number, parse } from '@remix-run/data-schema'

let User = object({ name: string(), age: number() })

let user = parse(User, { name: 'Ada', age: 37 })
```

Use `parseSafe()` when you prefer explicit branching over exceptions.

```ts
import { object, string, number, parseSafe } from '@remix-run/data-schema'

let User = object({ name: string(), age: number() })

let result = parseSafe(User, input)

if (!result.success) {
  // result.issues — array of { message, path? }
} else {
  let user = result.value
}
```

Both `parse` and `parseSafe` accept any [Standard Schema](https://standardschema.dev/) v1 schema, not just data-schema's own schemas. You can pass a Zod, Valibot, or ArkType schema and they'll work.

You can also customize built-in validation messages with `errorMap`:

```ts
import { object, parseSafe, string } from '@remix-run/data-schema'
import { minLength } from '@remix-run/data-schema/checks'

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

`errorMap` receives `{ code, defaultMessage, path, values, input, locale }`.
Return `undefined` to keep the default message.

## Primitives

```ts
import { string, number, boolean, bigint, symbol, null_, undefined_ } from '@remix-run/data-schema'

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
import { literal, enum_, union } from '@remix-run/data-schema'

// Exact value match
let yes = literal('yes')

// One of several allowed values
let Status = enum_(['active', 'inactive', 'pending'] as const)

// First schema that matches wins
let StringOrNumber = union([string(), number()])
```

## Objects

```ts
import { object, string, number, optional, defaulted } from '@remix-run/data-schema'

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
import { array, tuple, record, map, set, string, number, boolean } from '@remix-run/data-schema'

array(number()) // number[]
tuple([string(), number(), boolean()]) // [string, number, boolean]
record(string(), number()) // Record<string, number>
map(string(), number()) // Map<string, number>
set(number()) // Set<number>
```

## Modifiers

```ts
import { nullable, optional, defaulted, string, number } from '@remix-run/data-schema'

nullable(string()) // string | null
optional(number()) // number | undefined
defaulted(string(), 'n/a') // fills 'n/a' when undefined
```

## Instance checks

```ts
import { instanceof_, object } from '@remix-run/data-schema'

let Schema = object({
  created: instanceof_(Date),
  pattern: instanceof_(RegExp),
})
```

## Any

Accept any value without validation. Useful when part of a structure is opaque.

```ts
import { any, object, string } from '@remix-run/data-schema'

let Envelope = object({
  type: string(),
  payload: any(),
})
```

## Custom rules with `.refine()`

Add domain-specific validation logic inline. The predicate runs after the schema validates.

```ts
import { number, string, object } from '@remix-run/data-schema'

let Profile = object({
  username: string().refine((s) => s.length >= 3, 'Too short'),
  age: number().refine((n) => n >= 18, 'Must be an adult'),
})
```

## Validation pipelines with `.pipe()`

Compose reusable `Check` objects for common constraints.

```ts
import { object, string, number } from '@remix-run/data-schema'
import { minLength, maxLength, email, min, max } from '@remix-run/data-schema/checks'

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
import { object, parse } from '@remix-run/data-schema'
import * as coerce from '@remix-run/data-schema/coerce'

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
import { literal, number, object, string, variant } from '@remix-run/data-schema'

let Event = variant('type', {
  created: object({ type: literal('created'), id: string() }),
  updated: object({ type: literal('updated'), id: string(), version: number() }),
})
```

## Recursive schemas

Model trees and self-referencing structures. `lazy()` defers schema resolution to avoid circular references.

```ts
import { array, object, string } from '@remix-run/data-schema'
import { lazy } from '@remix-run/data-schema/lazy'
import type { Schema } from '@remix-run/data-schema'

type TreeNode = { id: string; children: TreeNode[] }

let Node: Schema<unknown, TreeNode> = lazy(() => object({ id: string(), children: array(Node) }))
```

## Aborting early

By default, validation collects all issues in a single pass. To stop at the first issue, enable `abortEarly`.

```ts
import { object, string, number, parseSafe } from '@remix-run/data-schema'

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
import { object, string, number } from '@remix-run/data-schema'
import type { InferInput, InferOutput } from '@remix-run/data-schema'

let User = object({ name: string(), age: number() })

type UserInput = InferInput<typeof User> // unknown
type UserOutput = InferOutput<typeof User> // { name: string; age: number }
```

## Extending data-schema

Build custom schemas using `createSchema`, `createIssue`, and `fail`. These are the same primitives used internally by every built-in schema.

```ts
import { createSchema, createIssue, fail } from '@remix-run/data-schema'
import type { Schema } from '@remix-run/data-schema'

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
