# form-data-middleware

Middleware for parsing [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) from incoming request bodies for use with [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router).

## Installation

```sh
npm install @remix-run/form-data-middleware
```

## Usage

Use the `formData()` middleware at the router level to parse `FormData` from the request body and make it available on the request context as `context.formData`.

`context.files` will also be available as a map of `File` objects keyed by the name of the form field.

```ts
import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'

let router = createRouter({
  middleware: [formData()],
})

router.post('/users', async (context) => {
  let name = context.formData.get('name')
  let email = context.formData.get('email')

  // Handle file uploads
  let avatar = context.files?.get('avatar')

  return Response.json({ name, email, hasAvatar: !!avatar })
})
```

### Custom File Upload Handler

You can use a custom upload handler to customize how file uploads are handled. The return value of the upload handler will be used as the value of the form field in the `FormData` object.

```ts
import { formData } from '@remix-run/form-data-middleware'
import { writeFile } from 'node:fs/promises'

let router = createRouter({
  middleware: [
    formData({
      async uploadHandler(upload) {
        // Save to disk and return path
        let path = `./uploads/${upload.name}`
        await writeFile(path, Buffer.from(await upload.arrayBuffer()))
        return path
      },
    }),
  ],
})
```

### Suppress Parse Errors

Some requests may contain invalid form data that cannot be parsed. You can suppress parse errors by setting `suppressErrors` to `true`. In these cases, `context.formData` will be an empty `FormData` object.

```ts
let router = createRouter({
  middleware: [
    formData({
      suppressErrors: true, // Invalid form data won't throw
    }),
  ],
})
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - The underlying form data parser

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
