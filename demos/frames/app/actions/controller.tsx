import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { assetServer } from '../utils/assets.ts'
import { ClientMountedPage } from './client-mounted.tsx'
import { HomePage } from './home.tsx'
import { ReloadScopePage } from './reload-scope.tsx'
import { rootReloadClientEntriesAction } from './root-reload-client-entries.tsx'
import { ScrollRestorationDetailPage, ScrollRestorationPage } from './scroll-restoration.tsx'
import { StateSearchRoutePage } from './state-search.tsx'
import { TimePage } from './time.tsx'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let assetResponse = await assetServer.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },

    home({ render }) {
      return render(<HomePage />)
    },

    time({ render }) {
      return render(<TimePage />)
    },

    reloadScope({ render }) {
      let pageNow = new Date()

      return render(<ReloadScopePage pageNow={pageNow} />)
    },

    stateSearch({ render, url }) {
      let initialQuery = url.searchParams.get('query') ?? ''

      return render(<StateSearchRoutePage initialQuery={initialQuery} />)
    },

    clientMounted({ render }) {
      return render(<ClientMountedPage />)
    },

    rootReloadClientEntries: rootReloadClientEntriesAction,

    scrollRestoration({ render, url }) {
      let newsletterHistory = getNewsletterHistory(url.searchParams.get('newsletter'))
      return render(<ScrollRestorationPage newsletterHistory={newsletterHistory} />)
    },

    scrollRestorationDetail({ render }) {
      return render(<ScrollRestorationDetailPage />)
    },

    async newsletterSignup({ request }) {
      let formData = await request.formData()
      let email = formData.get('email')
      let history = getNewsletterHistory(formData.get('history'))

      if (typeof email !== 'string' || email.trim() === '' || history === undefined) {
        return new Response('Enter an email address and choose a navigation type.', { status: 400 })
      }

      return redirect(
        routes.scrollRestoration.href(undefined, {
          searchParams: { newsletter: history },
        }),
        303,
      )
    },
  },
})

function getNewsletterHistory(value: unknown): 'push' | 'replace' | undefined {
  return value === 'push' || value === 'replace' ? value : undefined
}
