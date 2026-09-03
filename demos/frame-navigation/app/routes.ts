import { form, get, post, route } from 'remix/routes'

export const assetsBase = '/assets'

export const frames = {
  account: 'account',
  courses: 'courses',
  settings: 'settings',
} as const

export const routes = {
  assets: get(`${assetsBase}/*path`),
  main: route('/', {
    index: get('/'),
    courses: get('courses'),
    calendar: get('calendar'),
    account: route('account', {
      index: get('/'),
      edit: form('edit'),
    }),
  }),
  auth: route('auth', {
    login: form('login'),
    logout: post('logout'),
  }),
  settings: route('settings', {
    index: get('/'),
    overview: get('overview'),
    profile: get('profile'),
    notifications: get('notifications'),
    privacy: get('privacy'),
    grading: get('grading'),
    integrations: get('integrations'),
  }),
}
