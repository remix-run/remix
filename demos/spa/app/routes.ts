import { get, route } from 'remix/routes'

export const routes = route({
  home: get('/'),
  about: get('/about'),
  greet: '/greet',
})
