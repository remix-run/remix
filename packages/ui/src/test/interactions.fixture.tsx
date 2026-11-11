import { createRoot } from '@remix-run/component'
import Example from '../demos/interactions.demo.tsx'

const container = document.createElement('div')
container.id = 'app'
document.body.append(container)
createRoot(container).render(<Example />)
