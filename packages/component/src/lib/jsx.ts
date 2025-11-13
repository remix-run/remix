import type { RemixElement } from './remix-types.ts'

export function jsx(type: string, props: Record<string, any>, key?: string): RemixElement {
  return { type, props, key, $rmx: true }
}

export { jsx as jsxs, jsx as jsxDEV }
