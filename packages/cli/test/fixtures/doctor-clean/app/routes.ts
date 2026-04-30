import { form, route } from 'remix/routes'

export const routes = route({
  home: '/',
  about: '/about',
  contact: form('contact'),
})
