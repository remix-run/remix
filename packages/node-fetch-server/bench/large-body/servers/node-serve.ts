import { serve } from '@remix-run/node-serve'

serve(
  async (request) => {
    console.log(`method: ${request.method}`)
    for (let [key, value] of request.headers) {
      console.log(`${key}: ${value}`)
    }
    console.log(`body: ${await request.text()}`)

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
