# html-template

Safe HTML template literals for Remix. `html-template` automatically escapes interpolated values to prevent XSS while still supporting explicit trusted HTML insertion.

## Features

- **Automatic HTML escaping** - All interpolated values are escaped by default
- **Explicit raw HTML** - Use `html.raw` when you need unescaped HTML from trusted sources
- **Composable** - SafeHtml values can be nested without double-escaping
- **Type-safe** - Full TypeScript support with branded types
- **Zero dependencies** - Lightweight and self-contained
- **Runtime agnostic** - Works in Node.js, Bun, Deno, browsers, and edge runtimes

## Installation

```sh
npm i remix
```

## Usage

```ts
import { html } from 'remix/html-template'

let userInput = '<script>alert("XSS")</script>'
let greeting = html`<h1>Hello ${userInput}!</h1>`

console.log(String(greeting))
// Output: <h1>Hello &lt;script&gt;alert("XSS")&lt;/script&gt;!</h1>
```

By default, all interpolated values are automatically escaped to prevent XSS attacks.

If you have trusted HTML that should not be escaped, use `html.raw`:

```ts
import { html } from 'remix/html-template'

let trustedIcon = '<svg>...</svg>'
let button = html.raw`<button>${trustedIcon} Click me</button>`

console.log(String(button))
// => <button><svg>...</svg> Click me</button>
```

**Warning**: Only use `html.raw` with content you trust. Never use it with user input.

### Composing HTML Fragments

SafeHtml values can be nested without double-escaping:

```ts
import { html } from 'remix/html-template'

let title = html`<h1>My Title</h1>`
let content = html`<p>Some content with ${userInput}</p>`

let page = html`
  <!doctype html>
  <html>
    <body>
      ${title} ${content}
    </body>
  </html>
`
```

### Working with Arrays

You can interpolate arrays of values, which will be flattened and joined:

```ts
import { html } from 'remix/html-template'

let items = ['Apple', 'Banana', 'Cherry']
let list = html`
  <ul>
    ${items.map((item) => html`<li>${item}</li>`)}
  </ul>
`
```

### Conditional Rendering

Use `null` or `undefined` to render nothing:

```ts
import { html } from 'remix/html-template'

let showError = false
let errorMessage = 'Something went wrong'
let page = html`<div>${showError ? html`<div class="error">${errorMessage}</div>` : null}</div>`
```

## Related Packages

- [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - HTTP router that works great with html-template

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
