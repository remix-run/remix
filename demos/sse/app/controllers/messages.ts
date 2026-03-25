import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { getMessageLimit } from '../utils/message-limit.ts'

export let messagesAction = {
  handler(context) {
    let limit = getMessageLimit(context.url)

    let stream = new ReadableStream({
      start(controller) {
        let messageCount = 0

        let interval = setInterval(() => {
          try {
            messageCount++

            let timestamp = new Date().toLocaleTimeString()
            let text = `Message #${messageCount} at ${timestamp}`

            controller.enqueue(new TextEncoder().encode('event: message\n'))
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
          } catch {
            // Stream may already be closed.
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
  },
} satisfies BuildAction<'GET', typeof routes.messages>
