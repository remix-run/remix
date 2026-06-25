import { demoWithCode } from '../demo-with-code.tsx'
import { SpringDragReleaseDemo } from './spring-drag-release.demo.tsx'

let demoUrl = new URL('./spring-drag-release.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, SpringDragReleaseDemo)
