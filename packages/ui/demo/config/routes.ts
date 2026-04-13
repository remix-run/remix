import { get, route } from 'remix/fetch-router/routes'

import { EXAMPLE_LIST } from '../app/examples/index.tsx'
import { PAGE_LIST } from '../app/explorer/registry.tsx'

function toRoutePath(path: string) {
  return path === '/' ? '/' : path.slice(1)
}

let exampleRoutes = Object.fromEntries(
  EXAMPLE_LIST.map((example) => [example.id, get(example.slug)]),
) as Record<(typeof EXAMPLE_LIST)[number]['id'], ReturnType<typeof get>>

let apiRoutes = {
  airports: get('airports'),
}

let explorerRoutes = Object.fromEntries(
  PAGE_LIST.map((page) => [page.actionKey, get(toRoutePath(page.path))]),
) as Record<(typeof PAGE_LIST)[number]['actionKey'], ReturnType<typeof get>>

export let routes = {
  api: route('/api', apiRoutes),
  examples: route('/examples', exampleRoutes),
  explorer: route('/', explorerRoutes),
}
