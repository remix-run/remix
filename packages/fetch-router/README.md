# fetch-router

A minimal, composable router built on the [web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [`route-pattern`](../route-pattern). Ideal for building APIs, web services, and server-rendered applications across any JavaScript runtime.

## Features

- **Fetch API**: Built on standard web APIs that work everywhere - Node.js, Bun, Deno, Cloudflare Workers, and browsers
- **Type-Safe Routing**: Leverage TypeScript for compile-time route validation and parameter inference
- **Composable Architecture**: Nest routers, combine middleware, and organize routes hierarchically
- **Declarative Route Maps**: Define your entire route structure upfront with type-safe route names and HTTP methods
- **Flexible Middleware**: Apply middleware globally, per-route, or to entire route hierarchies
- **Easy Testing**: Use standard `fetch()` to test your routes - no special test harness required

## Goals

- **Simplicity**: A router should be simple to understand and use. The entire API surface fits in your head.
- **Composability**: Small routers combine to build large applications. Middleware and nested routers make organization natural.
- **Standards-Based**: Built on web standards that work across runtimes. No proprietary APIs or Node.js-specific code.

## Examples

The example below is a small site with 4 routes: a home page, an "about" page, and a blog.

```ts
import { createRouter, route, logger } from '@remix-run/fetch-router'

// Create a route map to organize your routes by name
let routes = route({
  home: '/',
  about: '/about',
  blog: {
    index: '/blog',
    show: '/blog/:slug',
  },
})

let router = createRouter()

router.use(logger())

// Provide handlers for your routes
router.map(routes, {
  home() {
    return new Response('Home')
  },
  about() {
    return new Response('About')
  },
  blog: {
    index() {
      return new Response('Blog')
    },
    async show({ params }) {
      // params.slug is type-safe
      return new Response(`Post ${params.slug}`)
    },
  },
})

let response = await router.fetch('https://remix.run/blog/hello-remix')
console.log(await response.text()) // "Post hello-remix"
```

You can generate a `<a href>` or specify a `<form action>` using the `href()` function on your routes. The example below is a small site with a simple "Contact Us" form.

Note: The `html()` helper is used in the example below to create a `Response` with the correct `Content-Type`.

```ts
import { createRouter, route, html } from '@remix-run/fetch-router'

let routes = route({
  home: '/',
  contact: '/contact',
})

let router = createRouter()

// `router.get()` defines a single GET handler
router.get(routes.home, () => {
  return html(`
    <html>
      <body>
        <h1>Home</h1>
        <p>
          <a href="${routes.contact.href()}">Contact Us</a>
        </p>
      </body>
    </html>
  `)
})

router.get(routes.contact, () => {
  return html(`
    <html>
      <body>
        <h1>Contact Us</h1>
        <form method="POST" action="${routes.contact.href()}">
          <div>
            <label for="message">Message</label>
            <input type="text" name="message" />
          </div>
          <button type="submit">Send</button>
        </form>
        <footer>
          <p>
            <a href="${routes.home.href()}">Home</a>
          </p>
        </footer>
      </body>
    </html>
  `)
})

router.post(routes.contact, ({ formData }) => {
  let message = formData.get('message') as string

  return html(`
    <html>
      <body>
        <h1>Thanks!</h1>
        <div>
          <p>You said: ${message}</p>
        </div>
        <footer>
          <p>
            <a href="${routes.home.href()}">Home</a>
          </p>
        </footer>
      </body>
    </html>
  `)
})
```

### Route Mapping with Specific HTTP Methods

Define routes that respond only to specific HTTP methods:

```ts
let routes = createRoutes({
  posts: {
    index: { method: 'GET', pattern: '/posts' },
    create: { method: 'POST', pattern: '/posts' },
    show: { method: 'GET', pattern: '/posts/:id' },
    update: { method: 'PUT', pattern: '/posts/:id' },
    destroy: { method: 'DELETE', pattern: '/posts/:id' },
  },
})

let router = createRouter()

// The structure of your handler map mirrors your route map
// exactly, with full type safety.
router.map(routes, {
  posts: {
    index() {
      return new Response('Posts')
    },
    create() {
      return new Response('Post Created', { status: 201 })
    },
    show({ params }) {
      return new Response(`Post ${params.id}`)
    },
    update({ params }) {
      return new Response(`Updated Post ${params.id}`)
    },
    destroy({ params }) {
      return new Response(`Deleted Post ${params.id}`)
    },
  },
})
```

### Resource-based Routes

Create resource-based route maps with the `resource` and `resources` functions. This can help DRY up your route definitions when creating RESTful APIs, Rails-style routes, etc.

```ts
import { resource, resources, createRoutes } from '@remix-run/fetch-router'

let routes = createRoutes({
  home: '/',
  books: resources('books'), // Plural resources
  profile: resource('profile'), // Singleton resource
})

let router = createRouter()

router.map(routes.home, () => new Response('Home'))

// Plural resources
router.map(routes.books, {
  index() {
    return new Response('Books')
  },
  create() {
    return new Response('Book Created', { status: 201 })
  },
  new() {
    return new Response('New Book')
  },
  show({ params }) {
    return new Response(`Book ${params.id}`)
  },
  edit({ params }) {
    return new Response(`Edit Book ${params.id}`)
  },
  update({ params }) {
    return new Response(`Updated Book ${params.id}`)
  },
  destroy({ params }) {
    return new Response(`Destroyed Book ${params.id}`)
  },
})

// Singleton resource
router.map(routes.profile, {
  show({ params }) {
    return new Response(`Profile ${params.id}`)
  },
  new() {
    return new Response('New Profile')
  },
  create() {
    return new Response('Profile Created', { status: 201 })
  },
  edit({ params }) {
    return new Response(`Edit Profile ${params.id}`)
  },
  update({ params }) {
    return new Response(`Updated Profile ${params.id}`)
  },
  destroy({ params }) {
    return new Response(`Destroyed Profile ${params.id}`)
  },
})
```

### Middleware

Apply middleware globally, per-route, or to entire route hierarchies:

```ts
import { createRouter } from '@remix-run/fetch-router'

let router = createRouter()

// Global middleware - runs for all routes
router.use((context, next) => {
  console.log(`${context.request.method} ${context.url.pathname}`)
  return next()
})

// Per-route middleware
router.get('/admin', [authenticate, authorize], () => new Response('Admin Dashboard'))

// Multiple middleware
router.post('/api/posts', [authenticate, validatePostData, rateLimit], async ({ request }) => {
  let data = await request.json()
  let post = await db.createPost(data)
  return new Response(JSON.stringify(post), { status: 201 })
})
```

### Middleware with `router.map()`

Apply middleware to all routes in a map, including nested routes:

```ts
let routes = createRoutes({
  public: '/',
  api: {
    users: '/api/users',
    posts: '/api/posts',
  },
  admin: {
    dashboard: '/admin/dashboard',
    users: '/admin/users',
  },
})

let router = createRouter()

// No middleware for public route
router.map(routes.public, () => new Response('Public'))

// CORS middleware for all API routes
router.map(routes.api, [cors({ origin: '*' })], {
  users() {
    return new Response(JSON.stringify(users))
  },
  posts() {
    return new Response(JSON.stringify(posts))
  },
})

// Auth middleware for all admin routes
router.map(routes.admin, [authenticate, requireAdmin], {
  dashboard() {
    return new Response('Dashboard')
  },
  users() {
    return new Response('User Management')
  },
})
```

Middleware defined in `router.map()` cascades to all nested routes, giving you fine-grained control over which routes get which middleware.

### Nested Routers

Compose routers to organize large applications:

```ts
let apiRouter = createRouter()
apiRouter.get('/users', () => new Response('Users'))
apiRouter.get('/posts', () => new Response('Posts'))

let adminRouter = createRouter()
adminRouter.get('/dashboard', () => new Response('Dashboard'))
adminRouter.get('/settings', () => new Response('Settings'))

let mainRouter = createRouter()

// Mount routers at specific paths
mainRouter.mount('/api', apiRouter)
mainRouter.mount('/admin', adminRouter)

mainRouter.get('/', () => new Response('Home'))

await mainRouter.fetch('https://example.com/api/users') // "Users"
await mainRouter.fetch('https://example.com/admin/dashboard') // "Dashboard"
```

Nested routers can have their own middleware, and parent middleware applies to all children.

### HTML Responses with the `html()` Helper

The `html()` helper makes it easy to return HTML responses with automatic content-type headers:

```ts
import { createRoutes, createRouter, html } from '@remix-run/fetch-router'

let routes = createRoutes({
  home: '/',
  about: '/about',
})

let router = createRouter()

router.get(routes.home, () =>
  html(`
    <!DOCTYPE html>
    <html>
      <head><title>Home</title></head>
      <body>
        <h1>Welcome</h1>
        <p><a href="${routes.about.href()}">About</a></p>
      </body>
    </html>
  `),
)

router.get(routes.about, () =>
  html(
    `
    <!DOCTYPE html>
    <html>
      <head><title>About</title></head>
      <body>
        <h1>About Us</h1>
        <p><a href="${routes.home.href()}">Home</a></p>
      </body>
    </html>
  `,
    { status: 200 },
  ),
)
```

The `html()` helper automatically dedents template strings, so your inline HTML looks clean in your code.

### Request Context

Every handler and middleware receives a request context with useful properties:

```ts
router.get('/posts/:id', ({ request, url, params, storage }) => {
  // request: The original Request object
  console.log(request.method) // "GET"
  console.log(request.headers.get('Accept'))

  // url: Parsed URL object
  console.log(url.pathname) // "/posts/123"
  console.log(url.searchParams.get('sort'))

  // params: Route parameters (fully typed!)
  console.log(params.id) // "123"

  // storage: AppStorage for type-safe access to request-scoped data
  storage.set('user', currentUser)

  return new Response(`Post ${params.id}`)
})
```

### Testing

Testing is simple because routers use the standard `fetch()` API:

```ts
import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('blog routes', () => {
  it('creates a new post', async () => {
    let response = await router.fetch('https://example.com/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hello', content: 'World' }),
    })

    assert.equal(response.status, 201)
    let post = await response.json()
    assert.equal(post.title, 'Hello')
  })

  it('returns 404 for missing posts', async () => {
    let response = await router.fetch('https://example.com/posts/999')
    assert.equal(response.status, 404)
  })
})
```

No special test harness or mocking required - just use `fetch()` like you would in production.

### Complete Example: Blog API

Here's a complete example showing many features working together:

```ts
import { createRoutes, createRouter, html } from '@remix-run/fetch-router'

// Define all routes upfront
let routes = createRoutes({
  home: '/',
  blog: {
    index: { method: 'GET', pattern: '/blog' },
    create: { method: 'POST', pattern: '/blog' },
    new: { method: 'GET', pattern: '/blog/new' },
    show: { method: 'GET', pattern: '/blog/:slug' },
    edit: { method: 'GET', pattern: '/blog/:slug/edit' },
    update: { method: 'PUT', pattern: '/blog/:slug' },
    destroy: { method: 'DELETE', pattern: '/blog/:slug' },
  },
})

let router = createRouter()

// Global logging middleware
router.use((context, next) => {
  console.log(`${context.request.method} ${context.url.pathname}`)
  return next()
})

// Bulk register routes with middleware
router.map(routes, {
  home() {
    return html(`
      <!DOCTYPE html>
      <html>
        <head><title>Blog</title></head>
        <body>
          <h1>My Blog</h1>
          <a href="${routes.blog.index.href()}">View Posts</a>
        </body>
      </html>
    `)
  },
  blog: {
    index() {
      let posts = db.getAllPosts()
      return html(`
        <!DOCTYPE html>
        <html>
          <head><title>Posts</title></head>
          <body>
            <h1>Blog Posts</h1>
            <a href="${routes.blog.new.href()}">New Post</a>
            <ul>
              ${posts.map((p) => `<li><a href="${routes.blog.show.href({ slug: p.slug })}">${p.title}</a></li>`).join('')}
            </ul>
          </body>
        </html>
      `)
    },
    new() {
      return html(`
        <!DOCTYPE html>
        <html>
          <head><title>New Post</title></head>
          <body>
            <h1>New Post</h1>
            <form action="${routes.blog.index.href()}" method="POST">
              <input name="title" required>
              <textarea name="content" required></textarea>
              <button type="submit">Create</button>
            </form>
          </body>
        </html>
      `)
    },
    async create({ request }) {
      let formData = await request.formData()
      let post = await db.createPost({
        title: formData.get('title'),
        content: formData.get('content'),
      })
      return Response.redirect(routes.blog.show.href({ slug: post.slug }), 303)
    },
    show({ params }) {
      let post = db.getPost(params.slug)
      if (!post) return new Response('Not Found', { status: 404 })

      return html(`
        <!DOCTYPE html>
        <html>
          <head><title>${post.title}</title></head>
          <body>
            <h1>${post.title}</h1>
            <div>${post.content}</div>
            <a href="${routes.blog.edit.href({ slug: post.slug })}">Edit</a>
          </body>
        </html>
      `)
    },
    edit({ params }) {
      let post = db.getPost(params.slug)
      return html(`
        <!DOCTYPE html>
        <html>
          <head><title>Edit ${post.title}</title></head>
          <body>
            <h1>Edit Post</h1>
            <form action="${routes.blog.show.href({ slug: params.slug })}" method="POST">
              <input type="hidden" name="_method" value="PUT">
              <input name="title" value="${post.title}" required>
              <textarea name="content" required>${post.content}</textarea>
              <button type="submit">Update</button>
            </form>
          </body>
        </html>
      `)
    },
    async update({ params, request }) {
      let formData = await request.formData()
      await db.updatePost(params.slug, {
        title: formData.get('title'),
        content: formData.get('content'),
      })
      return Response.redirect(routes.blog.show.href({ slug: params.slug }), 303)
    },
    destroy({ params }) {
      db.deletePost(params.slug)
      return Response.redirect(routes.blog.index.href(), 303)
    },
  },
})

export { router }
```

## Related Work

- [@remix-run/route-pattern](../route-pattern) - The pattern matching library that powers `fetch-router`
- [Express](https://expressjs.com/) - The classic Node.js web framework

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
