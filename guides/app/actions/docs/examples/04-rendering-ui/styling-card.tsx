import { demoWithCode } from '../demo-with-code.tsx'
import { StylingCardDemo } from './styling-card.demo.tsx'

let demoUrl = new URL('./styling-card.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, StylingCardDemo)
