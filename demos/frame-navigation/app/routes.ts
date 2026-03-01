import { get, route } from 'remix/fetch-router/routes'

export let routes = route({
  main: route({
    pages: {
      home: get('/'),
      settings: get('/settings'),
    },
    frames: route('frame/main', {
      home: get('/home'),
      settings: get('/settings'),
      dashboard: get('/dashboard'),
    }),
  }),
  dashboard: route('dashboard', {
    pages: {
      home: get('/'),
      customers: get('/customers'),
      sales: get('/sales'),
    },
    frames: route('frame', {
      shell: {
        home: get('/shell/home'),
        customers: get('/shell/customers'),
        sales: get('/shell/sales'),
      },
      content: {
        home: get('/content/activity'),
        customers: get('/content/customers'),
        sales: get('/content/sales'),
      },
    }),
  }),
})
