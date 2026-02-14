import { get, route } from 'remix/fetch-router/routes'

export let routes = route({
  marketing: {
    home: get('/'),
    frame: get('/frame'),
  },
})
