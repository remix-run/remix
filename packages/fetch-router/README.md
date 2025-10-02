# fetch-router

`fetch-router` is a minimal, composable router built on the [web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [`route-pattern`](../route-pattern).

```tsx
import { createRoutes, createRouter } from '@remix-run/fetch-router'

// Create a route map
// A route map is an object with string keys and `RoutePattern` values
// Keys are "route names" and may be arbitrarily nested
let routes = createRoutes({
  home: '/',
  about: '/about',
})

let router = createRouter()

// Add middleware
// Middleware run in the order they are added
router.use(logger())

// Add route handlers
// Route handlers are functions that return a response
// Route handlers run in the order they are added, same as middleware
router.get(routes.home, () => new Response('Home'))
router.get(routes.about, () => new Response('About'))

// "Fetch" the about page
let response = await router.fetch('https://remix.run/about')

console.log(response.status) // 200
console.log(await response.text()) // "About"
```

A more elaborate example, for a blog is below. This example uses the `html` helper to render HTML responses, the `route.href()` helper for generating type-safe URLs, and `router.post()` to handle a mutation.

```tsx
import { createRoutes, createRouter, html } from '@remix-run/fetch-router'

let routes = createRoutes({
  home: '/',
  blog: {
    index: '/blog',
    new: '/blog/new',
    show: '/blog/:id',
  },
})

let router = createRouter()

router.use(logger())

router.get(routes.home, () =>
  html(
    `
  <html>
    <head><title>Blog</title></head>
    <body>
      <h1>Blog</h1>
      <p><a href="${routes.blog.index.href()}">Blog</a></p>
    </body>
  </html>
  `,
    { status: 200 },
  ),
)

router.get(routes.blog.index, () =>
  html(`
  <html>
    <head><title>Blog</title></head>
    <body>
      <p><a href="${routes.home.href()}">Home</a></p>

      <h1>Blog</h1>
      <p><a href="${routes.blog.show.href({ id: '1' })}">Blog post 1</a></p>

      <p><a href="${routes.blog.new.href()}">Make a new blog post</a></p>
    </body>
  </html>
  `),
)

router.get(routes.blog.new, () => renderNewPostForm())

function renderNewPostForm() {
  return html(`
  <html>
    <head><title>Blog</title></head>
    <body>
      <p><a href="${routes.home.href()}">Home</a></p>
      <h1>New Blog Post</h1>
      <form action="${routes.blog.index.href()}" method="POST">
        <p><label>Title: <input name="title" required></label></p>
        <p><label>Slug: <input name="slug" required></label></p>
        <p><label>Content: <textarea name="content" required></textarea></label></p>
        <p><button type="submit">Create Post</button></p>
      </form>
    </body>
  </html>
  `)
}

router.post(routes.blog.index, async ({ request }) => {
  let formData = await request.formData()

  let title = formData.get('title')
  let slug = formData.get('slug')
  let content = formData.get('content')

  let newPost = await createBlogPost(title, slug, content)

  if (newPost) {
    return Response.redirect(routes.blog.show.href({ slug: newPost.slug }), 302)
  }

  return renderNewPostForm()
})

router.get(routes.blog.show, ({ params }) =>
  html(`
  <html>
    <head><title>Blog</title></head>
    <body>
      <p><a href="${routes.home.href()}">Home</a></p>
      <p><a href="${routes.blog.index.href()}">Blog</a></p>
      <h1>Blog post ${params.id}</h1>
    </body>
  </html>
  `),
)

// "Fetch" the blog post
let response = await router.fetch('https://remix.run/blog/1')

console.log(response.status) // 200
console.log(await response.text()) // "Blog post 1"
```

## Testing Mutations

Testing `fetch-router` is easy since developers can use the fetch primitives instead of using the Node.js `req`/`res` APIs. Continuing from the example above, we can test the mutation by sending a POST request to the blog index route.

```tsx
import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('creating a new blog post', () => {
  it('creates a new blog post', async () => {
    let response = await router.fetch('https://remix.run/blog/new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Test', slug: 'test', content: 'Test' }),
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), 'https://remix.run/blog/test')
  })
})
```

The `router.fetch()` method works just like the `fetch` API, so you can use all the fetch primitives to test your router.

## Router Composition

`fetch-router` is designed to be composable.

```tsx
let router = createRouter()

// Use a middleware
router.use(logger())

// Use an array of middleware
router.use([logger(), otherMiddleware()])

// Delegate request handling to `apiRouter`
router.use(apiRouter)

// Delegate request handling to `apiRouter`, but only under `/api`.
// When the request comes in, the prefix is stripped from the URL pathname
// before calling `apiRouter`'s fetch.
router.use('/api', apiRouter)
```
