import type { Controller } from 'remix/fetch-router'

import { createExternalProviderActions } from '../provider-actions.ts'
import type { AppContext } from '../../../router.ts'
import type { routes } from '../../../routes.ts'

export let googleAuthController = {
  actions: createExternalProviderActions('google'),
} satisfies Controller<typeof routes.auth.google, AppContext>
