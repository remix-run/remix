import { form, get, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: get(`${assetsBase}/*path`),
  home: get('/'),
  schema: form('/schema'),
  fields: form('/fields'),
  'extra-fields': form('/extra-fields'),
  inline: form('/inline'),
})
