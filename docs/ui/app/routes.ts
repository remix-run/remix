import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  docs: {
    index: get('/'),
    page: get('/:category/:slug(/)'),
  },
})
