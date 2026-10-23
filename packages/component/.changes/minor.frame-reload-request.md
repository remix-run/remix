`frame.reload()` accepts options to reload a different source or submit data to the frame without changing browser history. Pass `src` to reload another source in one call instead of assigning `frame.src` first, and pass `method`, `encType`, and `body` to send `FormData` through the frame resolver and render its response.

```tsx
let body = new FormData()
body.set('displayName', 'Ada')
await handle.frames.get('account')?.reload({ src: '/account/edit', method: 'post', body })
```

Like `<form>`, the method defaults to GET, which puts the `FormData` fields in the source's query string. POST defaults to URL encoding, and `encType` selects `multipart/form-data` or `text/plain`. See [Reload requests](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#reload-requests) for details.
