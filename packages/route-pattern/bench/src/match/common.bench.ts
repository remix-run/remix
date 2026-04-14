/**
 * Comparing industry standard routers vs route-pattern
 *
 * This benchmark uses only patterns that all libraries
 * can handle for a fair apples-to-apples comparison.
 * `route-pattern` also supports full URLs with protocols and
 * query string constraints which other libraries cannot handle.
 */
import { describe } from 'vitest'

import { matchers } from './matchers.ts'
import { benchMatchers } from './utils.ts'

function generateCommonPatterns(count: number): Array<string> {
  let patterns: Array<string> = []
  for (let i = 0; i < count; i++) {
    if (i % 5 === 0) {
      patterns.push(`/api/v${Math.floor(i / 100)}/users/${i}`)
    } else if (i % 5 === 1) {
      patterns.push(`/posts/:id/comments/${i}`)
    } else if (i % 5 === 2) {
      patterns.push(`/users/:userId/posts/:postId/${i}`)
    } else if (i % 5 === 3) {
      patterns.push(`/api/resource/${i}(/:version)`)
    } else {
      patterns.push(`/files/${i}/*path`)
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

for (let count of [10, 100, 1000, 5000]) {
  let patterns = generateCommonPatterns(count)

  describe(`common patterns (${count})`, () => {
    benchMatchers({
      matchers: [
        matchers.routePatternArray,
        matchers.routePatternTrie,
        matchers.findMyWay,
        matchers.pathToRegexp,
      ],
      patterns,
      urls: generateUrls(),
    })
  })
}
