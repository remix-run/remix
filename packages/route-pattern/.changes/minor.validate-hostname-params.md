`createHref` now encodes pathname params and validates hostname params

Pathname params now encode characters that would otherwise change URL structure when parsed. Variables encode `/`, `?`, `#`, `%`, and `\\`; wildcards preserve `/` as a path separator but encode the other structural characters.

```ts
createHref('/posts/:slug', { slug: 'hello/world?draft=true#preview' })
// before: '/posts/hello/world?draft=true#preview'
// after:  '/posts/hello%2Fworld%3Fdraft=true%23preview'

createHref('/files/*path', { path: 'docs/@remix-run/ui?raw#v1' })
// before: '/files/docs/@remix-run/ui?raw#v1'
// after:  '/files/docs/@remix-run/ui%3Fraw%23v1'
```

Hostname params are now validated so structural URL characters cannot change the URL authority when parsed. Hostname variables reject `.`, `@`, `:`, `/`, `?`, and `#`; hostname wildcards allow `.` to span labels but reject the other structural characters.

```ts
createHref('://:tenant.example.com/path', { tenant: 'acme.dev' })
// before: 'https://acme%2Edev.example.com/path'
// after:  throws CreateHrefError

createHref('://*tenant.example.com/path', { tenant: 'preview.acme' })
// before: 'https://preview.acme.example.com/path'
// after:  'https://preview.acme.example.com/path'

createHref('://*tenant.example.com/path', { tenant: 'preview:acme' })
// before: 'https://preview%3Aacme.example.com/path'
// after:  throws CreateHrefError
```
