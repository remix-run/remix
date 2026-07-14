# Data model forms demo

This demo shows how one Remix data model can drive native form constraints, server parsing, and accessible error rendering without taking ownership of the application's markup.

The registration flow demonstrates:

- selecting `displayName`, `email`, `age`, `website`, and `password` from an account model while omitting its server-owned `id`
- adding a UI-only terms checkbox with its own schema
- spreading low-level helpers directly onto native labels, inputs, and error elements
- blocking invalid submissions with the browser Constraint Validation API
- showing invalid state after blur and updating it as the user types
- returning a populated form with server errors after a failed POST
- omitting password values from the failed response and successful confirmation page

## Run the demo

From the repository root:

```sh
pnpm install
pnpm -C demos/data-model-forms dev
```

Open <http://localhost:44100>.

The demo keeps data in memory only for the duration of each request. A successful submission renders the typed, non-sensitive values that would normally be passed to application logic or persistence.

## How it works

The account schema remains the source of truth. `createForm()` selects the fields this UI needs and adds the ancillary terms field separately:

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

let account = submission.value
```

The form controls live inside a small `clientEntry()` component so the `form()` mixin can attach its blur and input listeners. Everything still renders on the server first. If JavaScript is unavailable, the same native constraints block invalid submissions and the server returns the same accessible error markup.

Try `a@b` as the email address to see the server-error path: browsers accept it as a native email value, while the data model's email rule requires a dotted domain. The returned page keeps the email and checkbox state, highlights the email error, and leaves the password blank.

## Verify the demo

```sh
pnpm -C demos/data-model-forms test
pnpm -C demos/data-model-forms typecheck
```
