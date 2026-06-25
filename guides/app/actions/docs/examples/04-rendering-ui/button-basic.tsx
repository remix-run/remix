import { demoWithCode } from '../demo-with-code.tsx'
import { ButtonBasic } from './public/button-basic.demo.tsx'

let demoUrl = new URL('./public/button-basic.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, ButtonBasic)
