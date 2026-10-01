# event-stream

Server-Sent Events and streaming helpers for the web Fetch API.

## Features

- **Fetch-native:** Returns a standard `Response` with a `ReadableStream` body
- **Server-Sent Events framing:** Serializes `event`, `id`, `retry`, and multi-line `data` fields
- **Disconnect handling:** Wires request aborts into the stream controller
- **Keep-alive comments:** Sends optional `: ping` frames for idle proxies
- **Model streaming:** Pipes async iterable text streams into event-stream responses
- **Client parsing:** Parses event-stream wire format in browsers and tests

## Installation

```sh
npm i remix
```

## Usage

### Server Events

```ts
import { eventStream } from 'remix/event-stream'

export async function loader({ request }: { request: Request }) {
  let events = eventStream({ request, keepAlive: 15_000 })

  queueMicrotask(() => {
    events.send({
      event: 'ready',
      id: '1',
      data: JSON.stringify({ ok: true }),
    })
  })

  return events.response
}
```

`eventStream()` reads the `Last-Event-ID` request header and exposes it as `lastEventId` so
routes can replay missed events.

```ts
import { eventStream } from 'remix/event-stream'

export function loader({ request }: { request: Request }) {
  let events = eventStream({ request })

  queueMicrotask(() => {
    if (events.lastEventId !== null) {
      events.send({ event: 'resume', data: events.lastEventId })
    }
  })

  return events.response
}
```

### Model Streaming

```ts
import { eventStream, streamText } from 'remix/event-stream'

async function* generateTokens(prompt: string) {
  yield 'Hello'
  yield ', '
  yield prompt
}

export function action({ request }: { request: Request }) {
  let events = eventStream({ request })

  void streamText(events, generateTokens('world'), {
    event: 'token',
  })

  return events.response
}
```

Use `writeText()` directly when the producer owns the loop:

```ts
import { eventStream } from 'remix/event-stream'

let events = eventStream()

events.writeText('First token', { event: 'token' })
events.writeText('Second token', { event: 'token' })
events.close()
```

### Client Consume

```ts
import { connectEventStream } from 'remix/event-stream/client'

let connection = connectEventStream('/events', {
  events: ['message', 'token'],
  onMessage(message) {
    console.log(message.event, message.id, message.data)
  },
})

// Later:
connection.close()
```

For tests and fetch-based consumers, parse raw event-stream text directly:

```ts
import { parseEventStream } from 'remix/event-stream/client'

let messages = parseEventStream('event: token\ndata: hello\n\n')
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
