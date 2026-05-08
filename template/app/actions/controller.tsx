import { createController } from 'remix/fetch-router'
import { Renderer } from 'remix/render-middleware'

import { assetServer } from '../assets.ts'
import { routes } from '../routes.ts'
import { HomePage } from '../ui/scaffold-home-page.tsx'
import { Layout } from '../ui/layout.tsx'

const controller = createController(routes, {
  actions: {
    async assets({ request }) {
      return (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 })
    },
    home({ get }) {
      let render = get(Renderer)
      return render(<HomePage />)
    },
    auth({ get }) {
      let render = get(Renderer)
      return render(<AuthPage />)
    },
  },
})

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
