import { get, route } from 'remix/fetch-router/routes'

export let routes = route({
  main: {
    index: get('/'),
    courses: get('courses'),
    calendar: get('calendar'),
    account: get('account'),
    settings: get('settings'),
  },
})
