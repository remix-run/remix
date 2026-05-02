import type { Controller } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { getMessageLimit } from '../utils/message-limit.ts'
import { render } from '../utils/render.ts'
import { HomePage } from './home.tsx'

export default {
  actions: {
    assets() {
      return new Response('Not found', { status: 404 })
    },
    home({ url }) {
      let limit = getMessageLimit(url)
      return render(<HomePage limit={limit} />)
    },
    messages({ request, url }) {
      let limit = getMessageLimit(url)

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

          request.signal.addEventListener('abort', () => {
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
  },
} satisfies Controller<typeof routes>
