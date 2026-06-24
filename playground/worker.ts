import { router } from './backend/router.ts'

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error('Error handling request:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
} satisfies ExportedHandler
