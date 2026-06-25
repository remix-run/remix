import { demoWithCode } from '../demo-with-code.tsx'
import { BouncySwitchDemo } from './public/bouncy-switch.demo.tsx'

let demoUrl = new URL('./public/bouncy-switch.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, BouncySwitchDemo)
