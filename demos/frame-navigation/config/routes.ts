import { get, route } from 'remix/fetch-router/routes'

export let routes = route({
  main: {
    index: get('/'),
    courses: get('courses'),
    calendar: get('calendar'),
    account: get('account'),
  },
  settings: route('settings', {
    index: get('/'),
    profile: get('profile'),
    notifications: get('notifications'),
    privacy: get('privacy'),
    grading: get('grading'),
    integrations: get('integrations'),
  }),
})
