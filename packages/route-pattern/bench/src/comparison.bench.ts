/**
 * Comparing industry standard routers vs route-pattern
 *
 * This benchmark uses only patterns that all libraries
 * can handle for a fair apples-to-apples comparison.
 * `route-pattern` also supports full URLs with protocols and
 * query string constraints which other libraries cannot handle.
 */

import { bench, describe } from 'vitest'
import FindMyWay from 'find-my-way'
import { match } from 'path-to-regexp'
import { ArrayMatcher, TrieMatcher } from '@remix-run/route-pattern'

type Syntax = 'route-pattern' | 'find-my-way' | 'path-to-regexp'

type Matcher = {
  add: (pattern: string, data?: unknown) => void
  match: (url: URL) => { params: unknown } | null
}

const matchers: Array<{
  name: string
  syntax: Syntax
  createMatcher: () => Matcher
}> = [
  {
    name: 'route-pattern/array',
    syntax: 'route-pattern',
    createMatcher: () => new ArrayMatcher(),
  },
  {
    name: 'route-pattern/trie',
    syntax: 'route-pattern',
    createMatcher: () => new TrieMatcher(),
  },
  {
    /** https://github.com/delvedor/find-my-way */
    name: 'find-my-way',
    syntax: 'find-my-way',
    createMatcher: () => {
      let router = FindMyWay()
      return {
        add(pattern) {
          router.on('GET', pattern, () => {})
        },
        match(url) {
          let result = router.find('GET', url.pathname)
          if (!result) return null
          return { params: result.params }
        },
      }
    },
  },
  {
    /** https://github.com/pillarjs/path-to-regexp */
    name: 'path-to-regexp',
    syntax: 'path-to-regexp',
    createMatcher: () => {
      let matchers: Array<ReturnType<typeof match>> = []
      return {
        add(pattern) {
          let matchFn = match(pattern, { decode: decodeURIComponent })
          matchers.push(matchFn)
        },
        match(url) {
          for (let match of matchers) {
            let result = match(url.pathname)
            if (result !== false) {
              return { params: result.params }
            }
          }
          return null
        },
      }
    },
  },
]

type Pattern = Record<Syntax, string>

function generateCommonPatterns(count: number): Array<Pattern> {
  let patterns: Array<Pattern> = []
  for (let i = 0; i < count; i++) {
    if (i % 5 === 0) {
      // Static paths
      patterns.push({
        'route-pattern': `api/v${Math.floor(i / 100)}/users/${i}`,
        'path-to-regexp': `/api/v${Math.floor(i / 100)}/users/${i}`,
        'find-my-way': `/api/v${Math.floor(i / 100)}/users/${i}`,
      })
    } else if (i % 5 === 1) {
      // Dynamic segments
      patterns.push({
        'route-pattern': `posts/:id/comments/${i}`,
        'path-to-regexp': `/posts/:id/comments/${i}`,
        'find-my-way': `/posts/:id/comments/${i}`,
      })
    } else if (i % 5 === 2) {
      // Multiple dynamic segments
      patterns.push({
        'route-pattern': `users/:userId/posts/:postId/${i}`,
        'path-to-regexp': `/users/:userId/posts/:postId/${i}`,
        'find-my-way': `/users/:userId/posts/:postId/${i}`,
      })
    } else if (i % 5 === 3) {
      // Optional segments at end (find-my-way requires optionals at end)
      patterns.push({
        'route-pattern': `api/resource/${i}(/:version)`,
        'path-to-regexp': `/api/resource/${i}{/:version}`,
        'find-my-way': `/api/resource/${i}/:version?`,
      })
    } else {
      // Wildcard at end of pathname
      patterns.push({
        'route-pattern': `files/${i}/*path`,
        'path-to-regexp': `/files/${i}/*path`,
        'find-my-way': `/files/${i}/*`,
      })
    }
  }
  return patterns
}

function generateUrls(): Array<URL> {
  let urls: string[] = []

  for (let i = 0; i < 20; i++) {
    urls.push(`api/v${i % 3}/users/${i}`)
    urls.push(`posts/post-${i}/comments/${i}`)
    urls.push(`users/user${i}/posts/post${i}/${i}`)
    urls.push(`api/resource/${i}`)
    urls.push(`api/resource/${i}/v${i % 2}`)
    urls.push(`files/${i}/deep/nested/path.txt`)
    urls.push(`files/${i}/another/file.js`)
    urls.push(`nonexistent/path/${i}`)
  }

  return urls.map((url) => new URL(`https://example.com/${url}`))
}

let urls = generateUrls()

for (let count of [10, 100, 1000, 5000]) {
  describe(`common patterns (${count})`, () => {
    let patterns = generateCommonPatterns(count)
    for (let { name, syntax, createMatcher } of matchers) {
      let matcher = createMatcher()
      patterns.forEach((pattern) => matcher.add(pattern[syntax]))
      bench(name, () => {
        urls.forEach((url) => matcher.match(url))
      })
    }
  })
}
