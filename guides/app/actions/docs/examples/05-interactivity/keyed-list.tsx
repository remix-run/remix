import { demoWithCode } from '../demo-with-code.tsx'
import { KeyedList } from './public/keyed-list.demo.tsx'

let demoUrl = new URL('./public/keyed-list.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, KeyedList)
