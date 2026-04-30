# routes

Typed route definitions and URL helpers for Remix apps.

## Features

- Build named route maps with strong route-pattern typing
- Generate hrefs from route definitions
- Compose nested route maps and reusable resource route groups
- Define routes with HTTP method helpers like `get`, `post`, `put`, and `del`

## Installation

```sh
npm i remix
```

## Usage

Define your app routes in one place and import the route map wherever you need type-safe href generation or router mappings.

```ts
import { form, get, route } from 'remix/routes'

export const routes = route({
  home: '/',
  posts: {
    index: get('/posts'),
    show: get('/posts/:slug'),
    search: form('/posts/search'),
  },
})

routes.posts.show.href({ slug: 'hello-world' })
```

## Route Maps

Use `route` to create named route maps. Nested objects become nested route groups, and string values create routes that accept any request method.

```ts
import { route } from 'remix/routes'

export const routes = route({
  home: '/',
  about: {
    index: '/about',
    company: '/about/company',
  },
})
```

You can also build a route group with a shared base pattern.

```ts
import { get, route } from 'remix/routes'

export const posts = route('/posts', {
  index: get('/'),
  show: get('/:slug'),
  edit: get('/:slug/edit'),
})
```

## Method Helpers

Use method helpers when a route should only match a specific HTTP method.

```ts
import { del, get, post, put, route } from 'remix/routes'

export const routes = route({
  posts: {
    index: get('/posts'),
    create: post('/posts'),
    update: put('/posts/:id'),
    destroy: del('/posts/:id'),
  },
})
```

## Forms And Resources

Use `form` for paired `GET` and submit-action routes, and `resource` or `resources` for conventional CRUD route groups.

```ts
import { form, resources, route } from 'remix/routes'

export const routes = route({
  login: form('/login'),
  posts: resources('/posts', { param: 'slug' }),
})
```

## Related Packages

- [`fetch-router`](../fetch-router) maps route definitions to Fetch API request handlers.
- [`route-pattern`](../route-pattern) provides the URL pattern matching and href generation used by route definitions.

## Related Work

- [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)
- [Rails resource routing](https://guides.rubyonrails.org/routing.html#resource-routing-the-rails-default)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
