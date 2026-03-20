# form-data-middleware

Form body parsing middleware for Remix. It parses incoming [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) and exposes it via `context.get(FormData)`.

## Features

- **Request Form Parsing** - Parses request body form data once per request
- **File Access** - Uploaded files are available from `context.get(FormData)`
- **Custom Upload Handling** - Supports pluggable upload handlers for file processing
- **Error Control** - Optional suppression for malformed form data

## Installation

```sh
npm i remix
```

## Usage

Use the `formData()` middleware at the router level to parse `FormData` from the request body and make it available on request context via `context.get(FormData)`.

Uploaded files are available in the parsed `FormData` object. For a single file field, use `formData.get(name)`. For repeated file fields, use `formData.getAll(name)`.

```ts
import { createRouter } from 'remix/fetch-router'
import { formData } from 'remix/form-data-middleware'

let router = createRouter({
  middleware: [formData()],
})

router.post('/users', async (context) => {
  let formData = context.get(FormData)
  let name = formData.get('name')
  let email = formData.get('email')

  // Handle file uploads
  let avatar = formData.get('avatar')

  return Response.json({ name, email, hasAvatar: avatar instanceof File })
})
```

### Custom File Upload Handler

You can use a custom upload handler to customize how file uploads are handled. The return value of the upload handler will be used as the value of the form field in the `FormData` object.

```ts
import { formData } from 'remix/form-data-middleware'
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

### Limit Multipart Growth

`formData()` forwards multipart limit options to `parseFormData()`, so you can cap uploads with
`maxHeaderSize`, `maxFiles`, `maxFileSize`, `maxParts`, and `maxTotalSize`.

```ts
let router = createRouter({
  middleware: [
    formData({
      maxFiles: 5,
      maxFileSize: 10 * 1024 * 1024,
      maxParts: 25,
      maxTotalSize: 12 * 1024 * 1024,
    }),
  ],
})
```

### Suppress Parse Errors

Some requests may contain invalid form data that cannot be parsed. You can suppress those malformed-body parse errors by setting `suppressErrors` to `true`. In these cases, `context.get(FormData)` will be an empty `FormData` object. Multipart limit violations from `maxHeaderSize`, `maxFiles`, `maxFileSize`, `maxParts`, or `maxTotalSize` are never suppressed.

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
