import { router } from './router.ts'

export default {
  async fetch(request, _env, _ctx): Promise<Response> {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
} satisfies ExportedHandler<Env>
