import { form, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: '/',
  about: '/about',
  contact: form('contact'),
})
