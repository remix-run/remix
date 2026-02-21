import { clientEntry } from '../utils/client.ts'

import assets from './colored-text.tsx?assets=client'
import './colored-text.css'

export let ColoredText = clientEntry(assets, 'ColoredText', function () {
  return () => <p class="colored-text">Hello, Colored Text</p>
})
