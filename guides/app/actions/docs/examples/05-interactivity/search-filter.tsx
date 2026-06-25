import { demoWithCode } from '../demo-with-code.tsx'
import { SearchFilterDemo } from './public/search-filter.demo.tsx'

let demoUrl = new URL('./public/search-filter.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, SearchFilterDemo)
