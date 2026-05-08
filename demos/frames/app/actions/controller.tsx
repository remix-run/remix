import { createController } from 'remix/fetch-router'
import { Renderer } from 'remix/render-middleware'

import { routes } from '../routes.ts'
import { ClientMountedPage } from './client-mounted.tsx'
import { HomePage } from './home.tsx'
import { ReloadScopePage } from './reload-scope.tsx'
import { rootReloadClientEntriesAction } from './root-reload-client-entries.tsx'
import { StateSearchRoutePage } from './state-search.tsx'
import { TimePage } from './time.tsx'

export default createController(routes, {
  actions: {
    home({ get }) {
      let render = get(Renderer)
      return render(<HomePage />)
    },

    time({ get }) {
      let render = get(Renderer)
      return render(<TimePage />)
    },

    reloadScope({ get }) {
      let render = get(Renderer)
      let pageNow = new Date()

      return render(<ReloadScopePage pageNow={pageNow} />)
    },

    stateSearch({ get, url }) {
      let render = get(Renderer)
      let initialQuery = url.searchParams.get('query') ?? ''

      return render(<StateSearchRoutePage initialQuery={initialQuery} />)
    },

    clientMounted({ get }) {
      let render = get(Renderer)
      return render(<ClientMountedPage />)
    },

    rootReloadClientEntries: rootReloadClientEntriesAction.handler,
  },
})
