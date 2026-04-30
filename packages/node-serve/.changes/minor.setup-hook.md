Add a `setup(app)` option to `serve()` so managed node-serve apps can register native uWebSockets.js WebSocket routes and connection filters before the Fetch fallback route starts listening.

```ts
import { serve } from 'remix/node-serve'

serve(handler, {
  setup(app) {
    app.ws('/ws/chat', {
      message(ws, message, isBinary) {
        ws.publish('chat', message, isBinary)
      },
    })

    app.filter((_res, count) => {
      console.log(`Active uWS connections: ${count}`)
    })
  },
})
```
