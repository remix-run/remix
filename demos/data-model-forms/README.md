# Data model forms demo

This demo shows how one Remix data model can drive native form constraints, server parsing, and accessible error rendering without taking ownership of the application's markup.

The registration flow demonstrates:

- selecting `displayName`, `email`, `age`, and `website` from the persisted account model while omitting its server-owned `id`
- adding request-only password and terms fields with their own schemas
- spreading low-level helpers directly onto native labels, inputs, and error elements
- blocking invalid submissions with the browser Constraint Validation API
- applying a model refinement through native custom validity as the user types
- showing inline validation messages and invalid state after blur, then updating both as the user types
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

Each router owns an in-memory SQLite database. It persists across requests for the lifetime of the demo process, while separately created routers receive isolated databases.

## How it works

The account schema remains the source of truth for persisted account data in `app/data/public/account-schema.ts`. `createForm()` selects the account fields this UI needs and adds request-only password and terms fields separately:

```ts
import * as s from 'remix/data-schema'
import { email, minLength } from 'remix/data-schema/checks'
import { createForm } from 'remix/data-schema/form'

let Account = s.object({
  id: s.string(),
  displayName: s
    .string()
    .pipe(minLength(2))
    .refine((value) => value.trim() === value, 'Remove leading or trailing spaces'),
  email: s.string().pipe(email()),
})

let RegistrationForm = createForm(Account, {
  fields: {
    displayName: { label: 'Display name', type: 'text' },
    email: { label: 'Email address', type: 'email' },
    password: {
      label: 'Password',
      type: 'password',
      schema: s.string().pipe(minLength(8)),
    },
    terms: {
      label: 'I agree to the terms of service',
      type: 'checkbox',
      schema: s.literal(true),
    },
  },
})
```

The data table validates writes with the `Account` schema directly. Because request-only fields are not part of `Account`, neither `password` nor `terms` can pass through the persistence model:

```ts
import * as s from 'remix/data-schema'
import { column as c, table } from 'remix/data-table'

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
    if (operation === 'update') {
      return { issues: [{ message: 'Account updates are not supported' }] }
    }

    let result = s.parseSafe(Account, value)
    return result.success
      ? { value: result.value }
      : { issues: result.issues.map((issue) => ({ message: issue.message })) }
  },
})
```

This POC has no account update flow, so it does not define an `AccountUpdate` schema. If partial updates are added later, that schema should be derived mechanically from `Account` rather than repeating each field by hand.

The router creates a `DatabaseSync(':memory:')` instance and exposes the resulting Remix `Database` through request middleware. Creating the database inside `createDataModelFormsRouter()` gives the server process persistent state while keeping router instances isolated.

The page owns its DOM structure. Its hydrated component creates the validation binding in setup and reads changing submissions through a getter:

```tsx
import { createFormMixins } from '@remix-run/ui/form'

let { form, input, error, errors } = createFormMixins(RegistrationForm, {
  getSubmission: () => handle.props.submission,
  onChange: () => handle.update(),
})

return () => (
  <form method="post" mix={form()}>
    <label {...RegistrationForm.getLabelAttrs('displayName')}>
      {RegistrationForm.fields.displayName.label}
      {RegistrationForm.fields.displayName.required ? <span>Required</span> : null}
    </label>
    <input autoComplete="name" mix={input('displayName')} />
    {errors.displayName.length > 0 ? (
      <p mix={error('displayName')} role="alert">
        {errors.displayName.join(' ')}
      </p>
    ) : null}
  </form>
)
```

The render middleware owns the shared document shell, so route pages only render their content. Its
second argument keeps document behavior separate from the underlying response options:

```ts
interface RenderOptions {
  document?: { title?: string } | false
  responseInit?: ResponseInit
}
```

Most handlers use the default document and may override only its title. A handler that serves a
frame or another partial HTML response can pass `document: false` without changing the content
component:

```tsx
return render(<RegistrationPage storedAccounts={storedAccounts} />, {
  document: { title: 'Create an account' },
})

return render(<RegistrationSummary account={account} />, {
  document: false,
})
```

This keeps frame content selection in the handler while the middleware remains responsible for the
generic HTML document, asset preloads, and client runtime script.

The POST action validates the request boundary in one call:

```tsx
let submission = RegistrationForm.parse(formData)

if (!submission.success) {
  return render(<RegistrationPage submission={submission} />, {
    responseInit: { status: 400 },
  })
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

The form controls live inside a small `clientEntry()` component so the mixins can attach their input and blur listeners. `createFormMixins(RegistrationForm, { getSubmission, onChange })` binds the form definition once in setup. Its destructured `form()` enhances plain native controls, and `input(field)` gives every projected input one validation mixin: it applies `getInputAttrs()` during SSR, checks native constraints first, then uses `createInputValidator()` to report supplemental synchronous schema issues through `setCustomValidity()`. The getter reads current submission props while rendering inputs or reading errors, while the binding preserves interaction state across ordinary renders. The input mixin owns touched state, `aria-invalid`, and `aria-describedby`; it reveals client errors after blur or a blocked submission. If JavaScript is unavailable, native constraints still block representable errors and the server returns accessible error markup for every schema issue.

With JavaScript enabled, add a leading or trailing space to the display name, then blur the input to see its non-native model refinement reported inline. To exercise the server-error path, disable JavaScript and submit `a@b` as the email address: browsers accept it as a native email value, while the data model's email rule requires a dotted domain. The returned page keeps the email and checkbox state, highlights the email error, and leaves the password blank.

The demo renders the binding's live `errors` arrays inline beside each input. `error(field)` supplies the generated error-element ID, and `onChange` requests a render when visible client messages change. The binding tracks submission changes and server errors internally, so the UI needs no error map or manual reset logic. It does not manage touched state or read `validationMessage` itself. Server errors stay visible until their field is edited, then client messages take over. The error mixin only supplies attributes; application markup owns content, visibility, and announcement behavior. The browser still owns constraint validation and its submission blocking behavior.

## Browser assets

Browser source lives in colocated `public/` directories, following the bookstore demo:

- `app/actions/public/entry.ts` starts the browser runtime.
- `app/actions/registration/public/` contains the hydrated form, form definition, and styles.
- `app/data/public/account-schema.ts` contains the shared schema used by both the form and database validation.

The asset server allows `app/**/public/**` and the shared route map, while denying test files. Controllers, database setup, and table definitions remain outside the browser asset boundary.

## Verify the demo

```sh
pnpm -C demos/data-model-forms typecheck
```
