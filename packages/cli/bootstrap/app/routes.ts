import { get, route } from 'remix/routes'

export const routes = route({
  assets: route('/assets', {
    index: get('/*path'),
  }),
  home: route('/', {
    index: '/',
  }),
  auth: route('/auth', {
    index: '/',
  }),
})
