import { demoWithCode } from '../demo-with-code.tsx'
import { AccordionMultiple } from './accordion-multiple.demo.tsx'

let demoUrl = new URL('./accordion-multiple.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, AccordionMultiple)
