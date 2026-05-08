import FindMyWay from 'find-my-way'
import { match } from 'path-to-regexp'
import { createMatcher, type Matcher } from '@remix-run/route-pattern'

import { ArrayMatcher } from './array-matcher.ts'

export let matchers = {
  routePatternArray: {
    name: 'route-pattern/array',
    createMatcher: () => new ArrayMatcher<null>(),
  },
  routePatternTrie: {
    name: 'route-pattern/trie',
    createMatcher: () => createMatcher<null>(),
  },
  findMyWay: {
    name: 'find-my-way',
    createMatcher: () => {
      let router = FindMyWay()
      return {
        ignoreCase: false,
        add(pattern: string) {
          let translated = pattern
            // optionals
            .replaceAll('(', '')
            .replaceAll(')', '?')
            // wildcards
            .replaceAll('*path', '*')
          router.on('GET', translated, () => {}, null)
        },
        match(url) {
          let pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
          let result = router.find('GET', pathname)
          if (!result) return null
          return { params: result.params } as any
        },
        matchAll(url) {
          let result = this.match(url)
          return result ? [result] : []
        },
      }
    },
  },
  pathToRegexp: {
    name: 'path-to-regexp',
    createMatcher: () => {
      let matchers: Array<ReturnType<typeof match>> = []

      return {
        ignoreCase: false,
        add(pattern: string) {
          let translated = pattern
            // optionals
            .replaceAll('(', '{')
            .replaceAll(')', '}')
            // wildcards
            .replaceAll('*', '*path')
          let matchFn = match(translated, { decode: decodeURIComponent })
          matchers.push(matchFn)
          // Simulate arbitrary ordering of patterns
          matchers.reverse()
        },
        match(url) {
          let pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
          for (let match of matchers) {
            let result = match(pathname)
            if (result !== false) {
              return { params: result.params } as any
            }
          }
          return null
        },
        matchAll(url) {
          let result = this.match(url)
          return result ? [result] : []
        },
      }
    },
  },
} satisfies Record<
  string,
  {
    name: string
    createMatcher: () => Matcher<null>
  }
>
