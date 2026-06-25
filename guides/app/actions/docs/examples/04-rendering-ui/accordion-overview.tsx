import { demoWithCode } from '../demo-with-code.tsx'
import { AccordionOverview } from './accordion-overview.demo.tsx'

let demoUrl = new URL('./accordion-overview.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, AccordionOverview)
