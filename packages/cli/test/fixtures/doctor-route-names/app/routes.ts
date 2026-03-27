import { form, route } from 'remix/fetch-router/routes'

export const routes = route({
  shared: form('shared'),
  common: form('common'),
})
