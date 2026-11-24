# Live Frames Demo

This demo connects `Frame` elements to routes that answer with `Content-Type: text/event-stream`. A live frame renders each event's HTML into the page without a reload, in whichever of the two shapes the route picks: an event that replaces what the frame shows, or an `append` event that adds to it. The departure boards replace, the operations log appends, and the page never asks for an update itself.

## Run It

```sh
cd demos/live-frames
pnpm install
pnpm dev
```

Visit [http://localhost:44100](http://localhost:44100). Watch the countdowns tick, type into a board's scratch note and watch it survive the next update, then use the browser network panel to count the open requests: four frames, three connections.

## Replace And Append

A frame diffs each event into its current content, so the departure board resends the whole board every second and only the cells that changed are touched. That keeps the typed scratch note, the focus ring, and the scroll position where they were.

```
id: 12
data: <div><table>…the whole board…</table></div>
```

An event named `append` adds its HTML after what the frame already shows, which suits anything that only ever grows. The log sends one snapshot when a frame connects, so a visitor who arrives late still sees the history, then one line per event.

```
event: append
id: 13
data: <p>01:12:04 Signal box handover complete</p>
```

Appended HTML joins the frame's content, not an element inside it, so the page wraps each frame in the surface that should contain everything a stream sends. [`app/ui/public/live-frame.tsx`](app/ui/public/live-frame.tsx) owns that wrapper; the streamed HTML owns only its own rows.

## Reacting From Outside The Frame

A frame dispatches `rmx:update` after each event renders, and the event bubbles, so the page can keep up with content it did not render itself. The log's heading counts rows that way, and the wrapper follows new lines while the reader is at the bottom and leaves the scroll alone once they have scrolled back.

```tsx
<div mix={on('rmx:update', (event) => recount(event.currentTarget))}>
  <Frame src={src} fallback={<Connecting />} />
</div>
```

`event.detail.kind` is `append` or `replace`, for a listener that only cares about one of them.

## One Connection Per Source

The concourse board and the waiting room board read the same URL, so they share one connection: both show the same connection number, and the server counts one request. The platform board reads a URL of its own and gets its own connection. A frame that joins an open connection is caught up at once, with the last snapshot and the appends since it, instead of waiting for the next event.

## Reconnection

**Drop the connection** asks the server to hang up on every open stream. The frames keep what they last rendered, reconnect a second later, and send `Last-Event-Id`, which the routes use to carry on numbering. The boards then say which event they resumed from, and the log picks up where it left off without repeating the lines it already sent.

## Explore the Code

- [`app/ui/public/live-frame.tsx`](app/ui/public/live-frame.tsx) mounts the `Frame` from a queued task. Frames rendered on the server resolve while the page does, and a stream that stays open never finishes resolving, so a live frame is created in the browser.
- [`app/actions/controller.tsx`](app/actions/controller.tsx) holds both streams. `board` renders the whole board per event; `log` sends a snapshot on connect and appends afterwards. Both honour `Last-Event-Id` and end when the demo drops them.
- [`app/ui/board.tsx`](app/ui/board.tsx) and [`app/ui/log.tsx`](app/ui/log.tsx) are ordinary server-rendered components. Nothing in them knows it is being pushed.
- [`app/data/board.ts`](app/data/board.ts) and [`app/data/log.ts`](app/data/log.ts) tick only while something is watching, and stop when the last stream goes away.
