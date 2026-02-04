import { hydrationRoot, createFrame, type Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'

////////////////////////////////////////////////////////////////////////////////
// Counter Component (Hydrated)
////////////////////////////////////////////////////////////////////////////////

let Counter = hydrationRoot('/counter.js#Counter', (handle: Handle) => {
  let count = 0

  return (props: { label: string }) => (
    <div css={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span>{props.label}:</span>
      <button
        css={{
          padding: '4px 12px',
          border: '1px solid #ccc',
          backgroundColor: '#fff',
          cursor: 'pointer',
          '&:hover': { backgroundColor: '#f0f0f0' },
        }}
        on={{
          click() {
            count--
            handle.update()
          },
        }}
      >
        −
      </button>
      <span css={{ minWidth: '32px', textAlign: 'center' }}>{count}</span>
      <button
        css={{
          padding: '4px 12px',
          border: '1px solid #ccc',
          backgroundColor: '#fff',
          cursor: 'pointer',
          '&:hover': { backgroundColor: '#f0f0f0' },
        }}
        on={{
          click() {
            count++
            handle.update()
          },
        }}
      >
        +
      </button>
    </div>
  )
})

////////////////////////////////////////////////////////////////////////////////
// App
////////////////////////////////////////////////////////////////////////////////

function App() {
  return () => (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SSR Demo</title>
      </head>
      <body css={{ fontFamily: 'system-ui, sans-serif', padding: '40px' }}>
        <h1 css={{ marginBottom: '24px' }}>SSR + Hydration Demo</h1>
        <div css={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Counter label="Apples" />
          <Counter label="Oranges" />
        </div>
      </body>
    </html>
  )
}

////////////////////////////////////////////////////////////////////////////////
// SSR + Hydration
////////////////////////////////////////////////////////////////////////////////

let modules: Record<string, Record<string, Function>> = {
  '/counter.js': { Counter },
}

async function main() {
  let html = await renderToString(<App />)

  document.open()
  document.write(html)
  document.close()

  let frame = createFrame(document, {
    loadModule(moduleUrl, exportName) {
      let mod = modules[moduleUrl]
      if (!mod) throw new Error(`Module not found: ${moduleUrl}`)
      let component = mod[exportName]
      if (!component) throw new Error(`Export not found: ${exportName} in ${moduleUrl}`)
      return component
    },
  })

  await frame.ready()

  console.log('Hydration complete!')
}
main()
