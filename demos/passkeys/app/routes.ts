import { del, get, post, route } from 'remix/routes'

export const routes = route({
  assets: '/assets/*path',
  home: get('/'),
  auth: route('auth', {
    signupOptions: post('/signup/options'),
    signup: post('/signup'),
    loginOptions: post('/login/options'),
    login: post('/login'),
    logout: post('/logout'),
  }),
  account: route('account', {
    index: get('/'),
    passkeyOptions: post('/passkeys/options'),
    addPasskey: post('/passkeys'),
    removePasskey: del('/passkeys/:passkeyId'),
  }),
})
