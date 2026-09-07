export const b = 5

const c = 6
export { c as d }

const e = 7
export { e as ef }

import { b as bb, d as dd, ef } from './test-self-import.js'

export default [bb, dd, ef]
