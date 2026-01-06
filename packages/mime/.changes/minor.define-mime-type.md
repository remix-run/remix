Add `defineMimeType()` for registering custom MIME types. This allows adding support for file extensions not included in the defaults, or overriding existing behavior. Custom registrations take precedence over built-in types.

```ts
import { defineMimeType, detectMimeType } from '@remix-run/mime'

defineMimeType({
  extensions: 'myformat',
  mimeType: 'application/x-myformat',
})

detectMimeType('file.myformat') // 'application/x-myformat'
```
