import { createController } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { ClientMountedPage } from './client-mounted.tsx'
import { HomePage } from './home.tsx'
import { ReloadScopePage } from './reload-scope.tsx'
import { rootReloadClientEntriesAction } from './root-reload-client-entries.tsx'
import { StateSearchRoutePage } from './state-search.tsx'
import { TimePage } from './time.tsx'

export default createController(routes, {
  actions: {
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

    rootReloadClientEntries: rootReloadClientEntriesAction.handler,
  },
})
