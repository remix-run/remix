import { demoWithCode } from '../demo-with-code.tsx'
import { DraggableMixinDemo } from './public/draggable-mixin.demo.tsx'

let demoUrl = new URL('./public/draggable-mixin.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, DraggableMixinDemo)
