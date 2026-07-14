import { css } from 'remix/ui'
import type { Handle } from 'remix/ui'

import type { AssetEntryValue } from '../../middleware/asset-entry.ts'

interface DemoPageProps {
  assetEntry: AssetEntryValue
}

export function DemoPage(handle: Handle<DemoPageProps>) {
  return () => {
    let { scriptPreloads, scriptSrc } = handle.props.assetEntry

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Model-backed forms</title>
          {scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script async type="module" src={scriptSrc} />
        </head>
        <body mix={bodyStyles}>
          <main mix={mainStyles}>
            <p mix={eyebrowStyles}>Remix data model forms</p>
            <h1 mix={headingStyles}>Model-backed forms</h1>
            <p mix={copyStyles}>The server and browser runtime are ready for the form example.</p>
          </main>
        </body>
      </html>
    )
  }
}

const bodyStyles = css({
  margin: 0,
  minHeight: '100vh',
  background: '#f7f7f4',
  color: '#20201e',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
})

const mainStyles = css({
  width: 'min(100% - 2rem, 48rem)',
  margin: '0 auto',
  paddingBlock: '4rem',
})

const eyebrowStyles = css({
  margin: 0,
  color: '#686861',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
})

const headingStyles = css({
  marginBlock: '0.5rem 1rem',
  fontSize: 'clamp(2rem, 8vw, 3.5rem)',
  letterSpacing: '-0.04em',
  lineHeight: 1,
})

const copyStyles = css({
  maxWidth: '38rem',
  margin: 0,
  color: '#4f4f49',
  fontSize: '1rem',
  lineHeight: 1.6,
})
