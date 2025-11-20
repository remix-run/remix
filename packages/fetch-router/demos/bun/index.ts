import { router } from './router.ts'

const PORT = 3000

Bun.serve({
  port: PORT,
  async fetch(request) {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
})

console.log(`Server running at http://localhost:${PORT}`)
