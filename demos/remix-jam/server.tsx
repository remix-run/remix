import * as http from 'node:http'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Readable } from 'node:stream'

import { createRequestListener } from '@remix-run/node-fetch-server'
import { renderToStream } from '@remix-run/dom/server'
import { Frame } from '@remix-run/dom'

import { HydratedCounter } from './app/public/counter.tsx'

function serveJavaScript(request: Request): Response | null {
  let url = new URL(request.url)
  let filepath = path.join(import.meta.dirname, url.pathname.slice(1))
  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) {
    return null
  }

  let fileStream = Readable.toWeb(fs.createReadStream(filepath))
  // @ts-expect-error need newer node types?
  let gzipStream = fileStream.pipeThrough(new CompressionStream('gzip'))
  // @ts-expect-error need newer node types?
  return new Response(gzipStream, {
    headers: {
      'Content-Type': 'application/javascript',
      'Content-Encoding': 'gzip',
      Vary: 'Accept-Encoding',
      'Cache-Control': 'no-store, must-revalidate',
    },
  })
}

async function handleRequest(request: Request) {
  let jsResponse = serveJavaScript(request)
  if (jsResponse) {
    return jsResponse
  }

  let html = renderToStream(
    <html>
      <head>
        <title>Remix Jam</title>
      </head>
      <body>
        <h1
          css={{
            color: 'red',
            '&:hover': { color: 'blue' },
          }}
        >
          Hello, world!
        </h1>
        <div>
          <Frame src="test" fallback={<div>Loading...</div>} />
        </div>

        <script async type="module" src="/dist/entry.js"></script>
      </body>
    </html>,
    {
      async resolveFrame(src) {
        await new Promise((resolve) => setTimeout(resolve, 1000))

        return <div>Loaded {src}!</div>
      },
      onError(error) {
        console.error(error)
      },
    },
  )

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

let server = http.createServer(createRequestListener(handleRequest))

server.listen(44100, () => {
  console.log('Server is running on http://localhost:44100')
})
