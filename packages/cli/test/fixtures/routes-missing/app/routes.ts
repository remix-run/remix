import { form, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: '/',
  auth: route('auth', {
    login: form('login'),
  }),
})
