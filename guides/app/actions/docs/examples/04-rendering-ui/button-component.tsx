import { demoWithCode } from '../demo-with-code.tsx'
import { ButtonComponent } from './button-component.demo.tsx'

let demoUrl = new URL('./button-component.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, ButtonComponent)
