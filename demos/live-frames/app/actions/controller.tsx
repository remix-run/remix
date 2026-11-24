import { createController } from 'remix/router'

import { Board } from '../ui/board.tsx'
import { LogHistory, LogRow } from '../ui/log.tsx'
import { countConnection, dropConnections } from '../data/connections.ts'
import { getLog, watchLog } from '../data/log.ts'
import { watchBoard } from '../data/board.ts'
import { eventStream } from '../utils/event-stream.ts'
import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'
import { HomePage } from './home.tsx'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let assetResponse = await assets.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },

    home({ render }) {
      return render(<HomePage />)
    },

    // Every event carries a whole board, so a frame that joins late, or reconnects, renders the
    // current state from the next event without asking for anything else.
    board({ request, url }) {
      let view = url.searchParams.get('view') ?? 'concourse'
      let connection = countConnection()
      let resumedFrom = request.headers.get('Last-Event-Id')

      return eventStream(request, (publish) => {
        let send = () =>
          publish('replace', (event) => (
            <Board view={view} connection={connection} event={event} resumedFrom={resumedFrom} />
          ))

        send()
        return watchBoard(send)
      })
    },

    // One connection carries both shapes: a snapshot to catch a frame up with the lines already
    // written, then appends that add one line at a time without resending the rest.
    log({ request }) {
      let resumedFrom = request.headers.get('Last-Event-Id')

      return eventStream(request, (publish) => {
        publish('replace', () => <LogHistory lines={getLog()} resumedFrom={resumedFrom} />)
        return watchLog((line) => publish('append', () => <LogRow line={line} />))
      })
    },

    drop() {
      dropConnections()
      return new Response(null, { status: 204 })
    },
  },
})
