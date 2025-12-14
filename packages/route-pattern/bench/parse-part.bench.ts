/**
 * This isn't really apples-to-apples since `lib2` produces an AST
 * that is designed for high speed generation of variants and trie branches
 * whereas `lib` is a general-purpose AST.
 *
 * Just want to make sure `lib2` is as fast (or faster) than `lib`,
 * but we won't see the full benefits of `lib2` until `lib` implements variant generation
 * or until `lib2` has a trie to compare matching perf against `lib`.
 */
import { bench } from 'vitest'

import { parsePart } from '../src/lib/parse.ts'
import { parse } from '../src/lib2/part/parse.ts'

let patterns = [
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

bench('lib', () => {
  patterns.forEach((pattern) => parsePart('', '/', pattern, 0, pattern.length))
})
bench('lib2', () => {
  patterns.forEach((pattern) => parse(pattern))
})
