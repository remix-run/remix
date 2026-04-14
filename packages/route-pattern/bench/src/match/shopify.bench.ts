import { patterns } from '../../patterns/shopify.ts'
import { matchers } from './matchers.ts'
import { benchMatchers } from './utils.ts'

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

benchMatchers({
  matchers: [matchers.pathToRegexp, matchers.routePatternArray, matchers.routePatternTrie],
  patterns,
  urls,
})
