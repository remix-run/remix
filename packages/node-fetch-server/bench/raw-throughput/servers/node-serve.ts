import { serve } from '@remix-run/node-serve'

serve(
  () => {
    let stream = new ReadableStream({
      start(controller) {
        controller.enqueue('<html><body><h1>Hello, world!</h1></body></html>')
        controller.close()
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/html' },
    })
  },
  { port: Number(process.env.PORT || 3000) },
)
