import type { BuildAction } from 'remix/fetch-router'

import { Document } from './components/layout.tsx'
import { render } from './utils/render.ts'
import type { routes } from './routes.ts'
import { ColoredText } from './components/colored-text.tsx'
import { Counter } from './components/counter.tsx'
import { DelayedFrame } from './components/delayed-frame.tsx'

export let home: BuildAction<'GET', typeof routes.marketing.home> = () =>
  render(
    <Document>
      <h1>Hello, Nitro + Remix</h1>
      <Counter setup={0} />
      <DelayedFrame />
    </Document>,
  )

export let frame: BuildAction<'GET', typeof routes.marketing.frame> = () => render(<ColoredText />)
