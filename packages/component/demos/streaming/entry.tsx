import { Frame, createFrame } from 'remix/component'
import { renderToStream } from 'remix/component/server'

function App() {
  return () => (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SSR Demo</title>
      </head>
      <body>
        <h1>Streaming Demo</h1>
        <Frame src="/frame-1" fallback={<div>Loading...</div>} />
      </body>
    </html>
  )
}

async function resolveFrame(src: string) {
  switch (src) {
    case '/frame-1': {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return renderToStream(
        <div>
          <h2>Frame 1</h2>
          <p>This is frame 1</p>
          <Frame src="/frame-2" fallback={<div>Loading...</div>} />
        </div>,
        { resolveFrame },
      )
    }
    case '/frame-2': {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return renderToStream(
        <div>
          <h3>Frame 2</h3>
          <p>This is frame 2</p>
        </div>,
        { resolveFrame },
      )
    }
    default:
      return renderToStream(<div>Unknown frame</div>)
  }
}

async function fakeDocumentLoad() {
  let stream = renderToStream(<App />, {
    resolveFrame: resolveFrame,
  })

  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let adopted = false

  document.open()
  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    document.write(decoder.decode(value, { stream: true }))

    if (!adopted) {
      adopted = true
      let frame = createFrame(document)
      frame.ready().catch((error) => console.error(error))
    }
  }

  // Flush any remaining decoder state
  document.write(decoder.decode())

  document.close()
}

document.addEventListener('click', fakeDocumentLoad)
