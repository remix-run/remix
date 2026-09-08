import FindMyWay from 'find-my-way'
import { match } from 'path-to-regexp'
import { createMultiMatcher, type MultiMatcher } from '@remix-run/route-pattern/match'

import { ArrayMatcher } from './array-matcher.ts'

type BenchData = {
  index: number
  pattern: string
}

export let matchers = {
  routePattern: {
    name: 'route-pattern',
    supportsDetailedVerification: true,
    createMatcher: () => createMultiMatcher<BenchData>(),
  },
  routePatternArray: {
    name: 'route-pattern/array',
    supportsDetailedVerification: true,
    createMatcher: () => new ArrayMatcher<BenchData>(),
  },
  findMyWay: {
    name: 'find-my-way',
    supportsDetailedVerification: false,
    createMatcher: () => {
      let router = FindMyWay()
      return {
        ignoreCase: false,
        add(pattern: string, data: unknown) {
          let translated = pattern
            // optionals
            .replaceAll('(', '')
            .replaceAll(')', '?')
            // wildcards
            .replaceAll('*path', '*')
          router.on('GET', translated, () => {}, data)
        },
        match(url: string | URL) {
          let pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
          let result = router.find('GET', pathname)
          if (!result) return null
          return { params: result.params, data: result.store } as any
        },
        matchAll(url: string | URL) {
          let result = this.match(url)
          return result ? [result] : []
        },
      }
    },
  },
  pathToRegexp: {
    name: 'path-to-regexp',
    supportsDetailedVerification: false,
    createMatcher: () => {
      let matchers: Array<{ match: ReturnType<typeof match>; data: unknown }> = []

      return {
        ignoreCase: false,
        add(pattern: string, data: unknown) {
          let translated = pattern
            // optionals
            .replaceAll('(', '{')
            .replaceAll(')', '}')
            // wildcards
            .replaceAll('*', '*path')
          let matchFn = match(translated, { decode: decodeURIComponent })
          matchers.push({ match: matchFn, data })
          // Simulate arbitrary ordering of patterns
          matchers.reverse()
        },
        match(url: string | URL) {
          let pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
          for (let matcher of matchers) {
            let result = matcher.match(pathname)
            if (result !== false) {
              return { params: result.params, data: matcher.data } as any
            }
          }
          return null
        },
        matchAll(url: string | URL) {
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
    supportsDetailedVerification: boolean
    createMatcher: () => MultiMatcher<unknown>
  }
>
