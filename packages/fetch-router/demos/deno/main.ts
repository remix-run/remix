import { router } from './app/router.ts'

const PORT = 44100

const server = Deno.serve(
  {
    port: PORT,
    onListen() {
      console.log(`Server running at http://localhost:${PORT}`)
    },
  },
  async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
)

// Windows only supports SIGINT and SIGBREAK; listening for SIGTERM there throws.
const shutdownSignals: Deno.Signal[] =
  Deno.build.os === 'windows' ? ['SIGINT'] : ['SIGINT', 'SIGTERM']

for (let signal of shutdownSignals) {
  Deno.addSignalListener(signal, async () => {
    console.log(`Received ${signal}, shutting down`)
    await server.shutdown()
    Deno.exit(0)
  })
}
