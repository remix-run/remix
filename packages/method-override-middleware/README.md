# method-override-middleware

Middleware for overriding HTTP request methods from form data for use with [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router).

Allows HTML forms (which only support GET and POST) to submit with other HTTP methods like PUT, PATCH, or DELETE by including a special form field.

## Installation

```sh
npm install @remix-run/method-override-middleware
```

## Usage

This middleware runs after [the `formData` middleware](https://github.com/remix-run/remix/tree/main/packages/form-data-middleware) and updates the request context's `context.method` with the value of the method override field. This is useful for simulating RESTful API request methods like PUT and DELETE using HTML forms.

```ts
import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'
import { methodOverride } from '@remix-run/method-override-middleware'

let router = createRouter({
  // methodOverride must come AFTER formData middleware
  middleware: [formData(), methodOverride()],
})

router.delete('/users/:id', async (context) => {
  let userId = context.params.id
  // Delete user logic...
  return new Response('User deleted')
})
```

In your HTML form:

```html
<form method="POST" action="/users/123">
  <input type="hidden" name="_method" value="DELETE" />
  <button type="submit">Delete User</button>
</form>
```

### Custom Field Name

You can customize the name of the method override field by passing a `fieldName` option to the `methodOverride()` middleware.

```ts
let router = createRouter({
  middleware: [formData(), methodOverride({ fieldName: '__method__' })],
})
```

```html
<form method="POST" action="/users/123">
  <input type="hidden" name="__method__" value="PUT" />
  <button type="submit">Update User</button>
</form>
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`form-data-middleware`](https://github.com/remix-run/remix/tree/main/packages/form-data-middleware) - Required for parsing form data

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
