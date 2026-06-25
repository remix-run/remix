import { demoWithCode } from '../demo-with-code.tsx'
import { BasicCounter } from './basic-counter.demo.tsx'

let demoUrl = new URL('./basic-counter.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, BasicCounter)
