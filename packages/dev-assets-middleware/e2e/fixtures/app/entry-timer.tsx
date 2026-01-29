import { createRoot } from '@remix-run/component'
import { Timer } from './Timer.tsx'

let root = createRoot(document.body)
root.render(<Timer />)
