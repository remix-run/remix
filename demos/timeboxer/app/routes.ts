import { del, form, get, post, put, route } from 'remix/routes'

export const routes = route({
  assets: route('/assets', {
    index: get('/*path'),
  }),
  home: route('/', {
    index: '/',
  }),
  auth: route('/auth', {
    index: '/',
    login: form('login'),
    logout: post('logout'),
    signup: form('signup'),
  }),
  schedules: route('/schedules', {
    index: get('/'),
    create: post('/'),
    destroy: del('/:scheduleId'),
    downloadIcs: get('/:scheduleId/download.ics'),
    show: get('/:scheduleId'),
    update: put('/:scheduleId'),
  }),
})
