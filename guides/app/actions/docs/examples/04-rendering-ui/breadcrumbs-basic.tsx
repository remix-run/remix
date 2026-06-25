import { demoWithCode } from '../demo-with-code.tsx'
import { BreadcrumbsBasic } from './breadcrumbs-basic.demo.tsx'

let demoUrl = new URL('./breadcrumbs-basic.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, BreadcrumbsBasic)
