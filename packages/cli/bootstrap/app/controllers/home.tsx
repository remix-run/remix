import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { render } from '../utils/render.tsx'

const APP_DISPLAY_NAME = decodeURIComponent('%%RMX_APP_DISPLAY_NAME_URI_COMPONENT%%')

export const home: BuildAction<'GET', typeof routes.home> = {
  handler() {
    return render(<HomePage />)
  },
}

function HomePage() {
  return () => (
    <Layout title="Home">
      <h1>{APP_DISPLAY_NAME}</h1>
      <p>This starter begins with two flat route files so you can start shipping immediately.</p>
      <p>
        Add new routes in <code>app/routes.ts</code>, keep them flat at first, and only split them
        into folders when the route grows.
      </p>
    </Layout>
  )
}
