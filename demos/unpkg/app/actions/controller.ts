import type { Controller } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { homeController } from './home/controller.ts'
import { packageBrowserController } from './package-browser/controller.ts'

export default {
  actions: {
    home: homeController,
    packageBrowser: packageBrowserController,
  },
} satisfies Controller<typeof routes>
