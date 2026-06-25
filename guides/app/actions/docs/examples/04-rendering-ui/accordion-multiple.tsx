import { demoWithCode } from '../demo-with-code.tsx'
import { AccordionMultiple } from './public/accordion-multiple.demo.tsx'

let demoUrl = new URL('./public/accordion-multiple.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, AccordionMultiple)
