import type { ComponentChildren } from 'preact'

import { preactEntryHref, preactEntryPreloads } from '../../utils/assets.ts'

interface DocumentProps {
  title: string
  children: ComponentChildren
}

export function Document({ title, children }: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/styles.css" />
        {preactEntryPreloads.map((href) => (
          <link key={href} rel="modulepreload" href={href} />
        ))}
        <script type="module" src={preactEntryHref} />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
