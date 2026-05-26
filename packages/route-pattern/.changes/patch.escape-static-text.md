Route pattern parsing now stores escaped static text without the escape marker

Escaped pattern characters in static text are now parsed into text tokens that contain the literal character without the leading `\\`. Serialization keeps emitting the escape marker so the pattern string still round-trips as escaped static text.

```ts
let pattern = RoutePattern.parse('/docs/npm\\:@scope/package')

pattern.pathname.tokens
// before: [{ type: 'text', text: 'docs' }, { type: 'separator' }, { type: 'text', text: 'npm\\:' }, ...]
// after:  [{ type: 'text', text: 'docs' }, { type: 'separator' }, { type: 'text', text: 'npm:' }, ...]

pattern.toString()
// before: '/docs/npm\\:@scope/package'
// after:  '/docs/npm\\:@scope/package'
```

```ts
let pattern = RoutePattern.parse('/files/report-\\(final\\).pdf')

pattern.pathname.tokens
// before: text tokens included '\\(' and '\\)'
// after:  text tokens include '(' and ')'

pattern.toString()
// before: '/files/report-\\(final\\).pdf'
// after:  '/files/report-\\(final\\).pdf'
```
