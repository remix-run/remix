import type { Handle } from 'remix/component'
import { unsafeHTML } from 'remix/component'

// The static site can't send redirects, so old `/api/...` URLs get a page that forwards to the
// new URL, keeping the hash.
export function LegacyRedirect(handle: Handle<{ href: string }>) {
  return () => {
    let { href } = handle.props
    let script = `location.replace(${JSON.stringify(href).replace(/</g, '\\u003c')} + location.hash)`

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="robots" content="noindex" />
          <meta http-equiv="refresh" content={`0; url=${href}`} />
          <link rel="canonical" href={href} />
          <title>Redirecting…</title>
          <script innerHTML={unsafeHTML(script)} />
        </head>
        <body>
          <a href={href}>{href}</a>
        </body>
      </html>
    )
  }
}
