import { post, route, form, resources } from 'remix/routes'

export const routes = route({
  home: '/',
  auth: {
    login: form('login'),
    logout: post('logout'),
  },
  account: route('account', {
    index: '/',
    orders: resources('orders', {
      only: ['index', 'show'],
      param: 'orderId',
    }),
  }),
  admin: route('admin', {
    users: resources('users', {
      only: ['index', 'show', 'edit', 'update', 'destroy'],
      param: 'userId',
    }),
  }),
})
