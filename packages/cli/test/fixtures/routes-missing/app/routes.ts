import { form, route } from 'remix/routes'

export const routes = route({
  home: '/',
  auth: route('auth', {
    login: form('login'),
  }),
})
