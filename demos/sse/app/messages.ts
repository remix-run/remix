import type { BuildRouteHandler } from '@remix-run/fetch-router'

import type { routes } from '../routes'

export let messages: BuildRouteHandler<'GET', typeof routes.messages> = (context) => {
  let stream = new ReadableStream({
    start(controller) {
      let messageCount = 0

      let interval = setInterval(() => {
        try {
          messageCount++

          let timestamp = new Date().toLocaleTimeString()
          let text = `Message #${messageCount} at ${timestamp}`

          // Send SSE formatted message
          controller.enqueue(new TextEncoder().encode(`event: message\n`))
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ count: messageCount, message: text })}\n\n`,
            ),
          )
        } catch (error) {
          console.error('Error enqueuing message:', error)
          clearInterval(interval)
        }
      }, 1000) // Send a message every second

      // Clean up on abort
      context.request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch (error) {
          // Stream may already be closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
