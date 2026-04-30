import { form, route } from 'remix/routes'

export const routes = route({
  home: '/',
  contact: form('contact'),
})
