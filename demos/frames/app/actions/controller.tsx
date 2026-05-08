import { createController } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { render } from './render.ts'
import { ClientMountedPage } from './client-mounted.tsx'
import { HomePage } from './home.tsx'
import { ReloadScopePage } from './reload-scope.tsx'
import { rootReloadClientEntriesAction } from './root-reload-client-entries.tsx'
import { StateSearchRoutePage } from './state-search.tsx'
import { TimePage } from './time.tsx'

export default createController(routes, {
  actions: {
    home() {
      return render(<HomePage />)
    },

    time() {
      return render(<TimePage />)
    },

    reloadScope() {
      let pageNow = new Date()

      return render(<ReloadScopePage pageNow={pageNow} />)
    },

    stateSearch({ url }) {
      let initialQuery = url.searchParams.get('query') ?? ''

      return render(<StateSearchRoutePage initialQuery={initialQuery} />)
    },

    clientMounted() {
      return render(<ClientMountedPage />)
    },

    rootReloadClientEntries: rootReloadClientEntriesAction.handler,
  },
})
