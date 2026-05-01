import type { Controller } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { homeAction } from './home.tsx'
import { messagesAction } from './messages.ts'

export default {
  actions: {
    assets() {
      return new Response('Not found', { status: 404 })
    },
    home: homeAction,
    messages: messagesAction,
  },
} satisfies Controller<typeof routes>
