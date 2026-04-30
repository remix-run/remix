import { get, route } from 'remix/routes'

import { PAGE_LIST } from '../app/explorer/registry.tsx'

function toRoutePath(path: string) {
  return path === '/' ? '/' : path.slice(1)
}

const exampleRoutes = {
  content: get(':slug/content'),
  show: get(':slug'),
}

const apiRoutes = {
  airports: get('airports'),
}

const explorerRoutes = Object.fromEntries(
  PAGE_LIST.map((page) => [page.actionKey, get(toRoutePath(page.path))]),
) as Record<(typeof PAGE_LIST)[number]['actionKey'], ReturnType<typeof get>>

export const routes = {
  api: route('/api', apiRoutes),
  examples: route('/examples', exampleRoutes),
  themeBuilder: get('/theme-builder'),
  explorer: route('/', explorerRoutes),
}
