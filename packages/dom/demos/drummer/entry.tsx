import { render } from '@remix-run/dom/spa'
import { App } from './app.tsx'

document.body.style.margin = '0'

let root = render(<App />, document.body)
