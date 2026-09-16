import type { ScriptEntry } from 'remix/assets'
import type { Handle } from 'remix/ui'
import { ImportMap } from 'remix/ui/server'

import { AssetsDemo } from './public/assets-demo.tsx'

interface HomePageProps {
  imageUrl: string
  scriptEntry: ScriptEntry
  styleUrl: string
  transformedImageUrl: string
  workerUrl: string
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { imageUrl, scriptEntry, styleUrl, transformedImageUrl, workerUrl } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>remix/assets demo</title>
          <link rel="stylesheet" href={styleUrl} />
          <ImportMap value={scriptEntry.importMap} />
          {scriptEntry.preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={scriptEntry.href} />
        </head>
        <body>
          <main class="page-shell">
            <h1>remix/assets</h1>
            <AssetsDemo workerUrl={workerUrl} />
            <section>
              <h2>File Transforms</h2>
              <div class="asset-previews" aria-label="Static asset previews">
                <figure class="asset-preview">
                  <img
                    class="asset-image"
                    src={imageUrl}
                    alt="Simple demo image"
                    width="120"
                    height="120"
                  />
                  <figcaption>Direct HTML image</figcaption>
                </figure>
                <figure class="asset-preview">
                  <img
                    class="asset-image"
                    src={transformedImageUrl}
                    alt="Purple transformed demo image"
                    width="120"
                    height="120"
                  />
                  <figcaption>Request-transformed image</figcaption>
                </figure>
                <figure class="asset-preview">
                  <div class="asset-background" aria-hidden="true" />
                  <figcaption>CSS background image</figcaption>
                </figure>
                <figure class="asset-preview">
                  <div
                    class="asset-background asset-background-request-transformed"
                    aria-hidden="true"
                  />
                  <figcaption>CSS request-transformed background image</figcaption>
                </figure>
              </div>
            </section>
          </main>
        </body>
      </html>
    )
  }
}
