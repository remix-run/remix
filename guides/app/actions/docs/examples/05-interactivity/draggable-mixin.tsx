import { demoWithCode } from '../demo-with-code.tsx'
import { DraggableMixinDemo } from './draggable-mixin.demo.tsx'

let demoUrl = new URL('./draggable-mixin.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, DraggableMixinDemo)
