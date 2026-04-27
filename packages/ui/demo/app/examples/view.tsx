import { Frame, css } from 'remix/component'
import type { Handle } from 'remix/component'
import { RMX_01, RMX_01_GLYPHS } from '@remix-run/ui/theme'

import {
  ExamplePreview,
  standaloneExampleBodyCss,
  standaloneExampleBodyPadCss,
} from '../example-preview.tsx'
import { getExampleContentHref, type ExampleEntry } from './index.tsx'

type ExampleContentProps = {
  ExampleComponent: any
  code: string
  description?: string
  example: ExampleEntry
  standalone?: boolean
  title?: string
}

export function ExampleDocument(handle: Handle<{ example: ExampleEntry; pad?: boolean }>) {
  return () => {
    let { example, pad = false } = handle.props
    return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <script async type="module" src="/assets/entry.js" />
        <title>{`${example.title} | RMX_01 Example`}</title>
        <RMX_01 />
      </head>
      <body
        mix={
          pad ? [standaloneExampleBodyCss, standaloneExampleBodyPadCss] : standaloneExampleBodyCss
        }
      >
        <RMX_01_GLYPHS />
        <main mix={shellCss}>
          <Frame src={getExampleContentHref(example, { standalone: true })} />
        </main>
      </body>
    </html>
  )
  }
}

export function ExampleContent(handle: Handle<ExampleContentProps>) {
  return () => {
    let { ExampleComponent, code, description, example, standalone = false, title } = handle.props
    return (
    <ExamplePreview
      code={code}
      description={description ?? example.description}
      href={standalone ? undefined : example.path}
      title={title ?? example.title}
    >
      <ExampleComponent />
    </ExamplePreview>
  )
  }
}

let shellCss = css({
  width: '100%',
  maxWidth: '64rem',
  marginInline: 'auto',
})
