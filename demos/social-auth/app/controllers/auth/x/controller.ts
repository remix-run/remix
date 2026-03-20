import type { Controller } from 'remix/fetch-router'

import { createExternalProviderActions } from '../provider-controller.ts'
import type { AppContext } from '../../../router.ts'
import type { routes } from '../../../routes.ts'

export let xAuthController = {
  actions: createExternalProviderActions('x'),
} satisfies Controller<typeof routes.auth.x, AppContext>
