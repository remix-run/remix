import { createRouter, type Middleware } from 'remix/router'
import { render, run } from 'remix/spa'
import {
  Layout,
  NotFoundPage,
  HomePage,
  AboutPage,
  GreetingPage,
  LoadingPage,
} from './components.tsx'
import { routes } from './routes.ts'
import { sleep } from './utils.ts'

// `render()` from `remix/spa` abstracts away the `spaResponse.create()` aspect
// that proxies the RemixNode through the WeakMap.
// Passing a callback allows you to use the render middleware to wrap a Layout
// component around your SPA routes.
const wrapRender = render((content, { url }) => <Layout url={url}>{content}</Layout>)

// Example usage of a normal middleware
const logSpaRequests: Middleware = async ({ request }, next) => {
  let url = new URL(request.url)
  let start = performance.now()
  console.log(`[SPA] → ${request.method} ${url.pathname}${url.search}`)
  let response = await next()
  let duration = Math.round(performance.now() - start)
  console.log(`[SPA] ← ${response.status} ${request.method} ${url.pathname} (${duration} ms)`)
  return response
}

// Create a normal router using the spa render middleware allowing us to render
// RemixNodes from handlers
const router = createRouter({
  middleware: [wrapRender, logSpaRequests],
  defaultHandler({ render }) {
    return render(<NotFoundPage />, { status: 404 })
  },
})

// Map controllers the same way we do in SSR
router.map(routes, {
  actions: {
    async home({ render, request }) {
      await sleep(700, request.signal)
      return render(<HomePage />)
    },
    async about({ render, request }) {
      await sleep(700, request.signal)
      return render(<AboutPage />)
    },
    greet({ render }) {
      return render(<GreetingPage name="friend" />)
    },
    async submitGreet({ render, request }) {
      let formData = await request.formData()
      let value = formData.get('name')
      let name = typeof value === 'string' && value.trim() !== '' ? value.trim() : 'friend'
      await sleep(700, request.signal)
      return render(<GreetingPage isSubmission name={name} />)
    },
  },
})

// `run()` from `remix/spa` is a wrapper around `remix/ui`'s `run()` that implements
// a SPA-aware `resolveFrame` and handles the fallback rendering and initial top-frame
// reload to render the initial UI
const app = run(router, { fallback: <LoadingPage /> })
app.addEventListener('error', (event) => {
  console.error('Remix SPA failed:', event.error)
})
await app.ready()
