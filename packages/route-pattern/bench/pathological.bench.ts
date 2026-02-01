import { bench, describe } from 'vitest'
import { ArrayMatcher, TrieMatcher } from '@remix-run/route-pattern'

function generateRoutes(): string[] {
  let routes: string[] = []

  for (let i = 0; i < 200; i++) {
    routes.push(`/static/path/${i}/resource`)
  }

  for (let i = 0; i < 300; i++) {
    let paramCount = (i % 4) + 1
    let segments: Array<string> = []
    for (let j = 0; j < paramCount; j++) {
      segments.push(`:param${j}`)
    }
    routes.push(`/dynamic/${i}/${segments.join('/')}`)
  }

  for (let i = 0; i < 150; i++) {
    let depth = (i % 3) + 1
    let pattern = `/optional/${i}`
    for (let j = 0; j < depth; j++) {
      pattern += `(/:opt${j})`
    }
    routes.push(pattern)
  }

  for (let i = 0; i < 100; i++) {
    routes.push(`/wildcard/${i}/*path`)
    routes.push(`/*prefix/middle/${i}/suffix`)
  }

  for (let i = 0; i < 150; i++) {
    routes.push(`https://:tenant${i}.myapp.com/admin`)
    routes.push(`http(s)://:subdomain.example${i}.com/api`)
    routes.push(`://:store.shop${i}.com/products/:id`)
  }

  for (let i = 0; i < 100; i++) {
    routes.push(`/search/${i}?q=&filter=`)
    routes.push(`/products/${i}?category=&price_min=&price_max=`)
  }

  routes.push('/:a/:b/:c/:d/:e/:f/:g/:h/:i/:j')
  routes.push('/blog/:year-:month-:day/:slug')
  routes.push('/archive/:year/:month/:day/:hour-:minute')
  routes.push('/api(/v:major(.:minor(.:patch)))/resources/:id(.:format)')
  routes.push('/docs(/:lang)(/:version)(/:section)(/:page)')
  routes.push('/*tenant/api/*version/resources/:id')
  routes.push('://localhost:3000/dev')
  routes.push('://localhost:8080/api')
  routes.push('/prefix:param/middle:param2/suffix')

  return routes
}

let routes = generateRoutes()
let urls = [
  'https://example.com/static/path/42/resource',
  'https://example.com/static/path/199/resource',
  'https://example.com/static/path/1000/resource',

  'https://example.com/dynamic/50/value1',
  'https://example.com/dynamic/150/value1/value2',
  'https://example.com/dynamic/250/value1/value2/value3',
  'https://example.com/dynamic/299/value1/value2/value3/value4',

  'https://example.com/optional/10',
  'https://example.com/optional/10/a',
  'https://example.com/optional/11/a/b',
  'https://example.com/optional/12/a/b/c',

  'https://example.com/wildcard/25/some/nested/path',
  'https://example.com/wildcard/99/deeply/nested/file.txt',
  'https://example.com/prefix/value/middle/50/suffix',
  'https://example.com/a/b/c/middle/99/suffix',

  'https://tenant42.myapp.com/admin',
  'https://tenant99.myapp.com/admin',
  'https://subdomain.example50.com/api',
  'http://subdomain.example100.com/api',
  'https://store.shop25.com/products/123',
  'https://store.shop149.com/products/abc-xyz',

  'https://example.com/search/42?q=test&filter=active',
  'https://example.com/products/99?category=electronics&price_min=100&price_max=500',

  'https://example.com/a/b/c/d/e/f/g/h/i/j',
  'https://example.com/blog/2024-12-01/my-post',
  'https://example.com/archive/2024/12/01/14-30',
  'https://example.com/api/resources/123',
  'https://example.com/api/v2/resources/456',
  'https://example.com/api/v2.1/resources/789.json',
  'https://example.com/api/v2.1.5/resources/999.xml',
  'https://example.com/docs',
  'https://example.com/docs/en',
  'https://example.com/docs/en/v2',
  'https://example.com/docs/en/v2/api',
  'https://example.com/docs/en/v2/api/reference',
  'https://example.com/tenant123/api/v1/resources/456',
  'http://localhost:3000/dev',
  'http://localhost:8080/api',
  'https://example.com/prefixvalue/middlevalue2/suffix',

  // misses
  'https://example.com/nonexistent/path',
  'https://example.com/static/wrong',
  'https://example.com/dynamic',
  'https://tenant999.wrongdomain.com/admin',
  'https://example.com/optional/999/extra/segments/that/dont/match',
  'http://localhost:9999/api',
  'https://example.com/search?missing=params',
]

describe('setup', () => {
  bench('array', () => {
    let matcher = new ArrayMatcher<null>()
    routes.forEach((route) => matcher.add(route, null))
  })

  bench('trie', () => {
    let matcher = new TrieMatcher<null>()
    routes.forEach((route) => matcher.add(route, null))
  })
})

describe('match', () => {
  let arrayMatcher = new ArrayMatcher<null>()
  routes.forEach((route) => arrayMatcher.add(route, null))
  bench('array', () => {
    urls.forEach((url) => arrayMatcher.match(url))
  })

  let trieMatcher = new TrieMatcher<null>()
  routes.forEach((route) => trieMatcher.add(route, null))
  bench('trie', () => {
    urls.forEach((url) => trieMatcher.match(url))
  })
})
