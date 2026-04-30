Expose the `node-serve` `setup(app)` option through `remix/node-serve` so apps can register native uWebSockets.js WebSocket routes and connection filters before the Fetch fallback route starts listening.

```ts
import { serve } from 'remix/node-serve'

serve(handler, {
  setup(app) {
    app.ws('/ws/chat', {
      message(ws, message, isBinary) {
        ws.publish('chat', message, isBinary)
      },
    })
  },
})
```
