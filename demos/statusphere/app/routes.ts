import { route } from 'remix/fetch-router'

export let routes = route({
  home: '/',
  oauth: {
    atproto: '/oauth/atproto/callback',
  },
})
