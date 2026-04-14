export default function Home() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Remix + React Template</title>
      </head>
      <body>
        <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Remix + React Template</h1>
          <p>
            Add routes in <code>src/routes.ts</code> and map them to frames in{' '}
            <code>src/entry.server.ts</code>.
          </p>
        </main>
      </body>
    </html>
  )
}
