import { form, route } from 'remix/fetch-router/routes'

export const routes = route({
  userSettings: '/user-settings',
  auth: {
    forgotPassword: form('forgot-password'),
    resetPassword: form('reset-password/:token'),
  },
})
