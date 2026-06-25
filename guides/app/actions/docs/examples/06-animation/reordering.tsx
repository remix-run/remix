import { demoWithCode } from '../demo-with-code.tsx'
import { ReorderingDemo } from './public/reordering.demo.tsx'

let demoUrl = new URL('./public/reordering.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, ReorderingDemo)
