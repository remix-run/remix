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

const logSpaRequests: Middleware = async ({ request }, next) => {
  let url = new URL(request.url)
  let start = performance.now()

  console.log(`[SPA] → ${request.method} ${url.pathname}${url.search}`)

  try {
    let response = await next()
    let duration = Math.round(performance.now() - start)

    console.log(`[SPA] ← ${response.status} ${request.method} ${url.pathname} (${duration} ms)`)

    return response
  } catch (error) {
    console.error(`[SPA] ✕ ${request.method} ${url.pathname}`, error)
    throw error
  }
}

const router = createRouter({
  middleware: [render((content, { url }) => <Layout url={url}>{content}</Layout>), logSpaRequests],
  defaultHandler({ render }) {
    return render(<NotFoundPage />, { status: 404 })
  },
})

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

const app = run(router, { fallback: <LoadingPage /> })
app.addEventListener('error', (event) => {
  console.error('Remix SPA failed:', event.error)
})
await app.ready()
