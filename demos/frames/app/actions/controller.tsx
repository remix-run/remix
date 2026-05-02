import type { Controller } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { render } from '../utils/render.ts'
import { ClientMountedPage } from './client-mounted.tsx'
import { HomePage } from './home.tsx'
import { ReloadScopePage } from './reload-scope.tsx'
import { StateSearchRoutePage } from './state-search.tsx'
import { TimePage } from './time.tsx'

export default {
  actions: {
    home({ request, router }) {
      return render(<HomePage />, { request, router })
    },

    time({ request, router }) {
      return render(<TimePage />, { request, router })
    },

    reloadScope({ request, router }) {
      let pageNow = new Date()

      return render(<ReloadScopePage pageNow={pageNow} />, {
        request,
        router,
      })
    },

    stateSearch({ request, router, url }) {
      let initialQuery = url.searchParams.get('query') ?? ''

      return render(<StateSearchRoutePage initialQuery={initialQuery} />, {
        request,
        router,
      })
    },

    clientMounted({ request, router }) {
      return render(<ClientMountedPage />, {
        request,
        router,
      })
    },
  },
} satisfies Controller<typeof routes>
