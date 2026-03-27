import { form, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: '/',
  contact: form('contact'),
})
