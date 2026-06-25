import { demoWithCode } from '../demo-with-code.tsx'
import { KeyedList } from './keyed-list.demo.tsx'

let demoUrl = new URL('./keyed-list.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, KeyedList)
