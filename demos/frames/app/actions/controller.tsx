import type { Controller } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { clientMountedAction } from './client-mounted.tsx'
import { homeAction } from './home.tsx'
import { reloadScopeAction } from './reload-scope.tsx'
import { stateSearchAction } from './state-search.tsx'
import { timeAction } from './time.tsx'

export default {
  actions: {
    home: homeAction,
    time: timeAction,
    reloadScope: reloadScopeAction,
    stateSearch: stateSearchAction,
    clientMounted: clientMountedAction,
  },
} satisfies Controller<typeof routes>
