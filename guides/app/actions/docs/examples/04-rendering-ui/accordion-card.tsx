import { demoWithCode } from '../demo-with-code.tsx'
import { AccordionCard } from './public/accordion-card.demo.tsx'

let demoUrl = new URL('./public/accordion-card.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, AccordionCard)
