import { form, route } from 'remix/routes'

export const routes = route({
  userSettings: '/user-settings',
  auth: {
    forgotPassword: form('forgot-password'),
    resetPassword: form('reset-password/:token'),
  },
})
