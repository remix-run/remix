import { demoWithCode } from '../demo-with-code.tsx'
import { ContextMenuTrigger } from './menu-context-trigger.demo.tsx'

let demoUrl = new URL('./menu-context-trigger.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, ContextMenuTrigger)
