import { demoWithCode } from '../demo-with-code.tsx'
import { MenuBubbling } from './public/menu-bubbling.demo.tsx'

let demoUrl = new URL('./public/menu-bubbling.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, MenuBubbling)
