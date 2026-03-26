import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.ts'
import { HomePage } from './page.ts'

export const homeController = {
  handler() {
    return render('UNPKG - npm package browser', HomePage())
  },
} satisfies BuildAction<'GET', typeof routes.home>
