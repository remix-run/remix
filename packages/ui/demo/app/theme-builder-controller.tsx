import type { RequestContext } from 'remix/fetch-router'

import { render } from '../config/render.tsx'
import { ThemeBuilderDocument } from './theme-builder-view.tsx'

export default function themeBuilderController(context: RequestContext) {
  return render(context, <ThemeBuilderDocument />, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
