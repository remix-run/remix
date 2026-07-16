# Data model forms demo

This demo shows how one Remix data model can drive native form constraints, server parsing, and accessible error rendering without taking ownership of the application's markup.

The registration flow demonstrates:

- selecting `displayName`, `email`, `age`, `website`, and `password` from an account model while omitting its server-owned `id`
- adding a UI-only terms checkbox with its own schema
- spreading low-level helpers directly onto native labels, inputs, and error elements
- blocking invalid submissions with the browser Constraint Validation API
- showing invalid state after blur and updating it as the user types
- returning a populated form with server errors after a failed POST
- validating database writes with the same field schemas used by the form
- persisting non-sensitive fields in an in-memory SQLite database across requests
- omitting password and UI-only terms values from both failed responses and stored rows

## Run the demo

From the repository root:

```sh
pnpm install
pnpm -C demos/data-model-forms dev
```

Open <http://localhost:44100>.

Each router owns an in-memory SQLite database. It persists across requests for the lifetime of the demo process, while a new router created by a test receives an isolated database.

## How it works

The client-safe account schema remains the source of truth in `app/data/account-schema.ts`. `createForm()` selects the fields this UI needs and adds the ancillary terms field separately:

```ts
import * as s from 'remix/data-schema'
import { email, minLength } from 'remix/data-schema/checks'
import { createForm } from 'remix/data-schema/form'

let Account = s.object({
  id: s.string(),
  displayName: s.string().pipe(minLength(2)),
  email: s.string().pipe(email()),
  password: s.string().pipe(minLength(8)),
})

let RegistrationForm = createForm(Account, {
  fields: {
    displayName: { label: 'Display name', type: 'text' },
    email: { label: 'Email address', type: 'email' },
    password: { label: 'Password', type: 'password' },
    terms: {
      label: 'I agree to the terms of service',
      type: 'checkbox',
      schema: s.literal(true),
    },
  },
})
```

The data table reuses the same field schemas for its write boundary. It projects only fields that are safe to store, so neither `password` nor the ancillary `terms` value can be passed through this model:

```ts
import * as s from 'remix/data-schema'
import { column as c, table } from 'remix/data-table'

let StoredAccount = s.object({
  id: Account.shape.id,
  displayName: Account.shape.displayName,
  email: Account.shape.email,
  age: Account.shape.age,
  website: Account.shape.website,
})

let StoredAccountUpdate = s.object({
  id: s.optional(Account.shape.id),
  displayName: s.optional(Account.shape.displayName),
  email: s.optional(Account.shape.email),
  age: s.optional(Account.shape.age),
  website: s.optional(Account.shape.website),
})

let accounts = table({
  name: 'accounts',
  columns: {
    id: c.text(),
    displayName: c.text(),
    email: c.text(),
    age: c.integer().nullable(),
    website: c.text().nullable(),
  },
  validate({ operation, value }) {
    let result = s.parseSafe(operation === 'create' ? StoredAccount : StoredAccountUpdate, value)
    return result.success
      ? { value: result.value }
      : { issues: result.issues.map((issue) => ({ message: issue.message })) }
  },
})
```

The router creates a `DatabaseSync(':memory:')` instance and exposes the resulting Remix `Database` through request middleware. Creating the database inside `createDataModelFormsRouter()` gives the server process persistent state while keeping test routers isolated.

The page owns its DOM structure and applies the generated attributes directly:

```tsx
import input from 'remix/ui/input'

<label {...RegistrationForm.getLabelAttrs('email')}>
  {RegistrationForm.fields.email.label}
</label>
<input
  {...RegistrationForm.getInputAttrs('email', submission)}
  autoComplete="email"
  mix={input()}
/>
```

The POST action validates the request boundary in one call:

```tsx
let submission = RegistrationForm.parse(formData)

if (!submission.success) {
  return render(<RegistrationPage submission={submission} />, { status: 400 })
}

let { displayName, email, age, website } = submission.value

await db.create(accounts, {
  id: crypto.randomUUID(),
  displayName,
  email,
  ...(age === undefined ? {} : { age }),
  ...(website === undefined ? {} : { website }),
})

return redirect(routes.registration.index.href(), 303)
```

The redirect makes the successful flow POST-redirect-GET. The following GET queries SQLite and renders every stored account, proving that the form payload reached the persistent data layer without retaining the raw password.

The form controls live inside a small `clientEntry()` component so the `form()` mixin can attach its blur and input listeners. Everything still renders on the server first. If JavaScript is unavailable, the same native constraints block invalid submissions and the server returns the same accessible error markup.

Try `a@b` as the email address to see the server-error path: browsers accept it as a native email value, while the data model's email rule requires a dotted domain. The returned page keeps the email and checkbox state, highlights the email error, and leaves the password blank.

## Verify the demo

```sh
pnpm -C demos/data-model-forms test
pnpm -C demos/data-model-forms typecheck
```
