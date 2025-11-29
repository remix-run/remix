import type { BuildAction } from '@remix-run/fetch-router'

import type { routes } from './routes'

export let messages: BuildAction<'GET', typeof routes.messages> = (context) => {
  let limitParam = context.url.searchParams.get('limit')
  let limit = limitParam ? parseInt(limitParam, 10) : null
  if (!limit || !isFinite(limit)) limit = null

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

          if (limit && messageCount >= limit) {
            clearInterval(interval)
            controller.close()
          }
        } catch (error) {
          console.error('Error enqueuing message:', error)
          clearInterval(interval)
        }
      }, 1000)

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
