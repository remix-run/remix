# form

`form()` progressively enhances native constraint validation with touched and accessible invalid state. `createInputMixin()` connects model-backed form definitions to native inputs without owning their markup.

```tsx
import * as s from 'remix/data-schema'
import { createForm } from 'remix/data-schema/form'
import { createInputMixin, form } from '@remix-run/ui/form'

let Signup = createForm(s.object({ email: s.string() }), {
  fields: { email: { label: 'Email', type: 'email' } },
})
let signupInput = createInputMixin(Signup)

function SignupPage() {
  return () => (
    <form method="post" mix={form()}>
      <label htmlFor="email">Email</label>
      <input autoComplete="email" mix={signupInput('email')} />
      <button type="submit">Create account</button>
    </form>
  )
}
```

## `createInputMixin(formDefinition)`

Creates one input mixin factory for a model-backed form definition. Each field mixin:

- applies generated ids, names, types, native constraints, restored values, and server error attributes during SSR
- runs the field's synchronous schema validator on `input` and reports its first issue through `setCustomValidity()`
- preserves explicit host props, so authored attributes such as `autoComplete` or an intentional `type` override win

Apply the returned mixin to every projected input, including fields whose schemas map entirely to native constraints. This keeps native and custom validation on one rendering path.

## `form()`

Apply this mixin to the containing native form. It:

- leaves fields unmarked while the user types before their first blur
- sets `data-touched` and synchronizes `aria-invalid` after blur
- observes native `invalid` events when the browser blocks submission
- clears stale server error linkage after an invalid field changes

Without JavaScript, native constraints still prevent invalid submissions and server-rendered errors remain accessible. Do not add `noValidate` unless the application intentionally opts out of native constraint validation.
