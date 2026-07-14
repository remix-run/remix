import { form, get, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: get(`${assetsBase}/*path`),
  registration: form('/'),
})
