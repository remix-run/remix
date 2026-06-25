import { demoWithCode } from '../demo-with-code.tsx'
import { DemoApp } from './public/readme-examples.demo.tsx'

let demoUrl = new URL('./public/readme-examples.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, DemoApp)
