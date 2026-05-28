import { get, route } from 'remix/routes'

const demoRoutes = {
  index: get('/'),
  show: get('/demo/*filename'),
}

export const routes = {
  demos: route(demoRoutes),
}
