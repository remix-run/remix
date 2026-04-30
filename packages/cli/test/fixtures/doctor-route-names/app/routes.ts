import { form, route } from 'remix/routes'

export const routes = route({
  shared: form('shared'),
  common: form('common'),
})
