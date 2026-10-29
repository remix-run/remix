/** @jsxImportSource react */
import type { ReactNode } from 'react'

import { reactEntryHref } from '../../utils/assets.ts'
import { reactImportMap } from './import-map.ts'

interface DocumentProps {
  title: string
  children: ReactNode
}

export function Document({ title, children }: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/styles.css" />
        {/*
          The import map must precede any module load. React hoists `<link>` elements ahead of
          it, so this document skips `modulepreload` links instead of racing the import map.
        */}
        <script
          type="importmap"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reactImportMap) }}
        />
        <script type="module" src={reactEntryHref} />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
