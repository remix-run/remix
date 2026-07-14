# form

`form()` progressively enhances native constraint validation with touched and accessible invalid state. It does not replace the browser's validation or own any form markup.

```tsx
import { form } from 'remix/ui/form'
import input from 'remix/ui/input'

function SignupForm() {
  return () => (
    <form method="post" mix={form()}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" required type="email" mix={input()} />
      <button type="submit">Create account</button>
    </form>
  )
}
```

The mixin:

- leaves fields unmarked while the user types before their first blur
- sets `data-touched` and synchronizes `aria-invalid` after blur
- observes native `invalid` events when the browser blocks submission
- clears stale server error linkage after an invalid field changes

Without JavaScript, native constraints still prevent invalid submissions and server-rendered errors remain accessible. Do not add `noValidate` unless the application intentionally opts out of native constraint validation.
