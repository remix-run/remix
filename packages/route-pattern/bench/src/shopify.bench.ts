import { bench, describe } from 'vitest'
import { match } from 'path-to-regexp'
import { ArrayMatcher, TrieMatcher } from '@remix-run/route-pattern'

import { patterns } from '../patterns/shopify.ts'

let urls: Array<URL> = [
  '/',
  '/start',
  '/free-trial',
  '/es/prueba-gratis',
  '/free-trial-new-years',
  '/uk/start',
  '/ca/free-trial',
  '/uk/free-trial',
  '/fr/demarrer',
  '/mx/prueba-gratis',
  '/co/prueba-gratis',
  '/au/start',
  '/it/aprire',
  '/ar/prueba-gratis',
  '/au/free-trial',
  '/es-es/prueba-gratis',
  '/de/starten',
  '/pe/prueba-gratis',
  '/nl/gratis-proef',
  '/tr/start',
  '/login',
  '/ca/free-trial-new-years',
  '/cl/prueba-gratis',
  '/__exp/manual-assignments',
  '/ca/start',
  '/ie/start',
  '/br/comecar',
  '/br/parcerias/directory/services/123/456',
  '/pl/blog/123',
].map((pathname) => new URL(`https://shopify.com${pathname}`))

describe('match shopify', () => {
  let pathToRegexpMatcher: Array<ReturnType<typeof match>> = []
  patterns.forEach((pattern) => {
    let matchFn = match(pattern.replace('(:locale)', '{:locale}').replace('*', '*path'), {
      decode: decodeURIComponent,
    })
    pathToRegexpMatcher.push(matchFn)
    pathToRegexpMatcher.reverse()
  })
  bench('path-to-regexp', () => {
    urls.forEach((url) => {
      for (let matchFn of pathToRegexpMatcher) {
        let match = matchFn(url.pathname)
        if (match !== false) {
          return
        }
      }
    })
  })

  let arrayMatcher = new ArrayMatcher<null>()
  patterns.forEach((pattern) => arrayMatcher.add(pattern, null))
  bench('array', () => {
    urls.forEach((url) => arrayMatcher.match(url))
  })

  let trieMatcher = new TrieMatcher<null>()
  patterns.forEach((pattern) => trieMatcher.add(pattern, null))
  bench('trie', () => {
    urls.forEach((url) => trieMatcher.match(url))
  })
})
