import { demoWithCode } from '../demo-with-code.tsx'
import { SpringDragReleaseDemo } from './public/spring-drag-release.demo.tsx'

let demoUrl = new URL('./public/spring-drag-release.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, SpringDragReleaseDemo)
