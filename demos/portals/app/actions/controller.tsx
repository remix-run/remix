import { fileURLToPath } from 'node:url'
import { css, Frame } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'
import { PortalExample, Reload } from './public/portal-example.tsx'
import { styles } from './public/styles.ts'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      return (await assets.fetch(request)) ?? new Response('Not found', { status: 404 })
    },
    async home({ render }) {
      let entry = await assets.getScriptEntry(
        fileURLToPath(new URL('./public/entry.ts', import.meta.url)),
      )
      return render(
        <html
          lang="en"
          mix={css({
            fontFamily: 'system-ui, sans-serif',
            color: '#202020',
            background: '#f7f7f5',
            colorScheme: 'light dark',
            '--surface': '#fff',
            '--border': '#bbb',
            '--control-border': '#ccc',
            '--muted': '#666',
            '--subtle-border': '#ddd',
            '--divider': '#eee',
            '--hover': '#efefed',
            '--secondary': '#ecece8',
            '& *': { boxSizing: 'border-box' },
            '& :focus-visible': { outline: '2px solid currentColor', outlineOffset: 3 },
            '@media (prefers-color-scheme: dark)': {
              color: '#eee',
              background: '#181818',
              '--surface': '#242424',
              '--border': '#555',
              '--control-border': '#555',
              '--muted': '#aaa',
              '--subtle-border': '#444',
              '--divider': '#444',
              '--hover': '#333',
              '--secondary': '#292929',
            },
          })}
        >
          <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Portals</title>
            <ImportMap value={entry.importMap} />
            {entry.preloads.map((href) => (
              <link key={href} rel="modulepreload" href={href} />
            ))}
            <script type="module" src={entry.href} />
          </head>
          <body
            mix={css({
              margin: 0,
              padding: '32px 20px',
              '@media (max-width: 600px)': { padding: '20px 12px' },
            })}
          >
            <main mix={css({ maxWidth: 960, margin: 'auto' })}>
              <header mix={[styles.header, css({ marginBottom: 24 })]}>
                <h1 mix={css({ margin: 0, fontSize: 28, letterSpacing: -1 })}>Portals</h1>
                <Reload label="Reload document" top />
              </header>
              <Frame name="owner" src={routes.owner.href()} />
              <div
                mix={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 20,
                  alignItems: 'start',
                  '@media (max-width: 600px)': { gridTemplateColumns: '1fr' },
                })}
              >
                <Frame name="container-a" src={routes.container.href({ name: 'a' })} />
                <Frame name="container-b" src={routes.container.href({ name: 'b' })} />
              </div>
            </main>
          </body>
        </html>,
        { headers: { 'Cache-Control': 'no-store' } },
      )
    },
    owner({ render }) {
      return render(
        <PortalExample servedAt={new Date().toISOString()} renderId={crypto.randomUUID()} />,
        {
          headers: { 'Cache-Control': 'no-store' },
        },
      )
    },
    container({ render, params }) {
      if (params.name !== 'a' && params.name !== 'b')
        return new Response('Not found', { status: 404 })
      let name = params.name.toUpperCase()
      let servedAt = new Date().toISOString()
      return render(
        <section
          class="destination"
          mix={[styles.panel, css({ minHeight: 132 })]}
          id={`container-${params.name}`}
          data-rmx-key={params.name}
          aria-label={`Container ${name}`}
        >
          <header mix={styles.header}>
            <h2 mix={styles.heading}>Container {name}</h2>
            <Reload label={`Reload ${name}`} />
          </header>
          <time
            mix={[styles.muted, styles.timestamp, css({ display: 'block', marginTop: 12 })]}
            dateTime={servedAt}
            data-render-id={crypto.randomUUID()}
          >
            {servedAt.slice(11, 23)}
          </time>
        </section>,
        { headers: { 'Cache-Control': 'no-store' } },
      )
    },
    inside({ render }) {
      let servedAt = new Date().toISOString()
      return render(
        <div
          class="inner-frame"
          aria-label="Inner frame"
          mix={[
            styles.header,
            styles.muted,
            css({
              marginTop: 18,
              paddingTop: 12,
              borderTop: '1px solid var(--divider)',
              '& button': { fontSize: 12 },
            }),
          ]}
        >
          <span>
            Inner frame{' '}
            <time
              mix={css({ display: 'inline-block' })}
              dateTime={servedAt}
              data-render-id={crypto.randomUUID()}
            >
              {servedAt.slice(11, 23)}
            </time>
          </span>
          <Reload label="Reload inner frame" />
        </div>,
        { headers: { 'Cache-Control': 'no-store' } },
      )
    },
  },
})
