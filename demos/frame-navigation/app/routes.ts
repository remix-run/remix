import { form, get, post, route } from 'remix/fetch-router/routes'

export const frames = {
  settings: 'settings',
} as const

export const routes = {
  main: route('/', {
    index: get('/'),
    courses: get('courses'),
    calendar: get('calendar'),
    account: get('account'),
  }),
  auth: route('auth', {
    login: form('login'),
    logout: post('logout'),
  }),
  settings: route('settings', {
    index: get('/'),
    profile: get('profile'),
    notifications: get('notifications'),
    privacy: get('privacy'),
    grading: get('grading'),
    integrations: get('integrations'),
  }),
}
