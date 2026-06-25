import { demoWithCode } from '../demo-with-code.tsx'
import { NoticePresenceDemo } from './notice-presence.demo.tsx'

let demoUrl = new URL('./notice-presence.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, NoticePresenceDemo)
