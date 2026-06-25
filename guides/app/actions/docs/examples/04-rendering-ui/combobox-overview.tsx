import { demoWithCode } from '../demo-with-code.tsx'
import { ComboboxOverview } from './public/combobox-overview.demo.tsx'

let demoUrl = new URL('./public/combobox-overview.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, ComboboxOverview)
