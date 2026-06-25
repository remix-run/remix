import { demoWithCode } from '../demo-with-code.tsx'
import { ControlledUncontrolledValues } from './controlled-uncontrolled-values.demo.tsx'

let demoUrl = new URL('./controlled-uncontrolled-values.demo.tsx', import.meta.url)

export const handler = demoWithCode(demoUrl, ControlledUncontrolledValues)
