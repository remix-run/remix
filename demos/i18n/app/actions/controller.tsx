import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { isSupportedLanguage, localeCookie } from '../i18n/config.ts'
import { i18nMiddleware } from '../middleware/i18n.ts'
import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'

export const rootController = createController(routes, {
  middleware: [i18nMiddleware()],
  actions: {
    home({ i18n, render }) {
      return render(<HomePage i18n={i18n} />)
    },
    async language({ formData }) {
      let intent = formData.get('intent')
      if (intent === 'clear') {
        return redirect(routes.home.href(), {
          status: 303,
          headers: {
            'Set-Cookie': await localeCookie.serialize('', {
              expires: new Date(0),
              maxAge: 0,
            }),
          },
        })
      }
      if (intent !== null) {
        return new Response('Invalid intent', { status: 400 })
      }

      let locale = formData.get('locale')
      if (!isSupportedLanguage(locale)) {
        return new Response('Invalid locale', { status: 400 })
      }

      return redirect(routes.home.href({ locale }), {
        status: 303,
        headers: {
          'Set-Cookie': await localeCookie.serialize(locale),
        },
      })
    },
  },
})
