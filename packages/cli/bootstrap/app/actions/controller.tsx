import { createAssetServer } from 'remix/assets'
import type { Controller } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { HomePage } from '../ui/scaffold-home-page.tsx'
import { Layout } from '../ui/layout.tsx'
import { render } from '../utils/render.tsx'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
  },
  allow: ['app/assets/**', 'node_modules/**'],
  deny: ['app/**/*.server.*'],
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})

const controller = {
  actions: {
    async assets({ request }) {
      return (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 })
    },
    home({ request }) {
      return render(<HomePage />, request)
    },
    auth({ request }) {
      return render(<AuthPage />, request)
    },
  },
} satisfies Controller<typeof routes>

export default controller

function AuthPage() {
  return () => (
    <Layout title="Auth">
      <h1>Auth</h1>
      <p>Use this route to start building sign-in, sign-up, and session flows.</p>
      <p>Add nested route-map keys and explicit controllers when this feature grows.</p>
    </Layout>
  )
}
