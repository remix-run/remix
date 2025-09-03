# RoutePattern vs. URLPattern

The web has a built-in URL matcher called [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern). Why don't we use it instead of creating our own thing with [`RoutePattern`](../packages/route-pattern)?

## Main Differences

There are a number of major differences between `RoutePattern` and `URLPattern`. Here are the main ones:

- `RoutePattern` comes with an "href builder" for building URLs from route patterns. This is the logical bookend to "matching" or parsing a URL.

- `RoutePattern` allows matching only a URL pathname without resorting to the object syntax, or beginning with a leading `/`

```tsx
let pattern = new RoutePattern('products/:id') // matches <protocol>://<host>/products/:id
// vs. URLPattern, requires object syntax and leading slash
let pattern = new URLPattern({ pathname: '/products/:id' })
```

- `RoutePattern` does not allow regex syntax. This means route patterns are statically analyzable without parsing RegExp grammar, which makes it easier to provide type safety. Also, the whole point of `RoutePattern` is to provide a syntax that is sufficient for matching URLs without resorting to some other syntax.

- `RoutePattern` does not support "unnamed groups" that must be accessed by index in the match result. Instead, all variables (groups) must have names and are accessed by that name at `match.params[name]`.

- `RoutePattern` expresses optionals using parentheses, similar to Rails. These read like English instead of using `?` to indicate optional groups as in regular expressions. It also makes the start and end positions of an optional group immediately obvious.

```tsx
// An "optional group" using URLPattern
let pattern = new URLPattern('/books/:id?', 'https://example.com')
pattern.test('https://example.com/books/123') // true
pattern.test('https://example.com/books') // true
// This behavior is unintuitive. Is the ":id" optional? Or the "/:id"?
// There's no way to know when you only have a single group modifier character (the `?`)
pattern.test('https://example.com/books/') // false

// An optional using RoutePattern
let pattern = new RoutePattern('/books(/:id)')
pattern.test('https://example.com/books/123') // true
pattern.test('https://example.com/books') // true
// This result is more intuitive because the () surround the optional
// portion of the pattern, indicating both start and end characters
pattern.test('https://example.com/books/') // false
```

- `RoutePattern` does not treat the pattern's search string as exhaustive. This allows matching URLs that contain additional query parameters, which is important for allowing traffic that comes from sources where you don't have full control over the search string.

```tsx
let pattern = new RoutePattern('?q=remix')
pattern.exec('https://remix.run/?q=remix') // match
pattern.exec('https://remix.run/?q=remix&utm_source') // also match!

let pattern = new URLPattern({ search: '?q=remix' })
pattern.exec('https://remix.run/?q=remix') // match
pattern.exec('https://remix.run/?q=remix&utm_source') // null :(
```
