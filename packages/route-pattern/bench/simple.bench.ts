import { bench, describe } from 'vitest'
import { ArrayMatcher, TrieMatcher } from '@remix-run/route-pattern'

let routes = [
  '/',
  '/about',
  '/contact',
  '/pricing',
  '/blog',
  '/docs',
  '/login',
  '/signup',
  '/blog/:slug',
  '/users/:id',
  '/users/:id/settings',
  '/users/:id/posts',
  '/products/:id',
  '/products/:id/reviews',
  '/docs/:category',
  '/docs/:category/:page',
  '/api/v1/products',
  '/api/v1/products/:id',
  '/api/v1/users/:userId',
  '/posts/:id',
  '/posts/:id/comments',
  '/posts/:id/comments/:commentId',
  '/categories/:category',
  '/tags/:tag',
  '/users/:userId/posts/:postId',
  '/products/:id/reviews/:reviewId',
  '/products/:category/:slug',
  '/blog/:year/:month/:day/:slug',
  '/api/v1/users/:userId/orders/:orderId',
  '/docs/:lang/:category/:page',
  '/api(/v:version)/orders',
  '/api(/v:version)/orders/:orderId',
  '/users/:id(.:format)',
  '/posts/:slug(.html)',
  '/docs(/:section)(/:page)',
  '/products/:id(/reviews)',
  '/assets/images/*path',
  '/downloads/*',
  '/files/*path',
  '/static/*',
]

let urls = [
  'https://example.com/',
  'https://example.com/about',
  'https://example.com/contact',
  'https://example.com/pricing',
  'https://example.com/blog',
  'https://example.com/blog/introducing-remix',
  'https://example.com/blog/route-patterns',
  'https://example.com/users/123',
  'https://example.com/users/456/settings',
  'https://example.com/users/789/posts',
  'https://example.com/users/123/posts/456',
  'https://example.com/products/wireless-headphones',
  'https://example.com/products/laptop/reviews',
  'https://example.com/products/laptop/reviews/5',
  'https://example.com/products/electronics/laptop',
  'https://example.com/docs/getting-started',
  'https://example.com/docs/api/reference',
  'https://example.com/api/v1/products',
  'https://example.com/api/v1/products/123',
  'https://example.com/api/v1/users/456',
  'https://example.com/api/orders',
  'https://example.com/api/v2/orders',
  'https://example.com/api/v2/orders/789',
  'https://example.com/posts/hello-world',
  'https://example.com/posts/123/comments',
  'https://example.com/posts/123/comments/456',
  'https://example.com/categories/electronics',
  'https://example.com/tags/javascript',
  'https://example.com/blog/2024/12/01/year-in-review',
  'https://example.com/users/123.json',
  'https://example.com/posts/my-post.html',
  'https://example.com/docs/getting-started',
  'https://example.com/docs/en/api/reference',
  'https://example.com/products/123/reviews',
  'https://example.com/assets/images/logo.png',
  'https://example.com/assets/images/icons/home.svg',
  'https://example.com/downloads/report.pdf',
  'https://example.com/files/documents/contract.pdf',
  'https://example.com/static/css/main.css',
  'https://example.com/login',
  'https://example.com/signup',
  'https://example.com/api/v1/users/999/orders/888',
  'https://example.com/blog/2024/12',
  'https://example.com/users',
  'https://example.com/products',
  'https://example.com/api/v3/products',
  'https://example.com/docs/en',
  'https://example.com/posts/123/likes',
  'https://example.com/categories',
  'https://example.com/users/123/followers',
  'https://example.com/api/orders/123/items',
  'https://example.com/blog/2024',
  'https://example.com/settings',
  'https://example.com/profile',
  'https://example.com/admin',
  'https://example.com/dashboard',
  'https://example.com/api/v1/admin',
  'https://example.com/nonexistent',
  'https://example.com/foo/bar/baz',
  'https://example.com/test',
]

describe('setup', () => {
  bench('array', () => {
    let matcher = new ArrayMatcher<null>()
    for (let route of routes) {
      matcher.add(route, null)
    }
  })

  bench('trie', () => {
    let matcher = new TrieMatcher<null>()
    for (let route of routes) {
      matcher.add(route, null)
    }
  })
})

describe('match', () => {
  let arrayMatcher = new ArrayMatcher<null>()
  for (let route of routes) {
    arrayMatcher.add(route, null)
  }
  bench('array', () => {
    urls.forEach((url) => arrayMatcher.match(url))
  })

  let trieMatcher = new TrieMatcher<null>()
  for (let route of routes) {
    trieMatcher.add(route, null)
  }
  bench('trie', () => {
    urls.forEach((url) => trieMatcher.match(url))
  })
})
