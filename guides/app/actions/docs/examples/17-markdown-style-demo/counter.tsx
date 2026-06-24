import { demoWithCode } from '../demo-with-code.tsx'
import { Counter } from './counter.demo.tsx'

let demoUrl = new URL('./counter.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, Counter)
