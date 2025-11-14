import type { EventListeners } from '@remix-run/interaction'

/**
 * Any valid element type accepted by JSX or `createElement`.
 * - `string` for host elements (e.g., 'div')
 * - `Function` for user components
 */
export type ElementType = string | Function

/**
 * Generic bag of props passed to elements/components.
 * Consumers should define specific prop types on their components; this is the
 * renderer's normalized shape used throughout reconciler/SSR code.
 */
export type ElementProps = Record<string, any>

/**
 * A virtual element produced by JSX/`createElement` describing UI.  Carries a
 * `$rmx` brand used to distinguish it from plain objects at runtime.
 */
export interface RemixElement {
  type: ElementType
  props: ElementProps
  key?: string | undefined
  $rmx: true
}

/**
 * Any single value Remix can render. Booleans render as empty text.
 */
export type Renderable = RemixElement | string | number | bigint | boolean | null | undefined

/**
 * Anything that Remix can render, including arrays of renderable values.
 * Particularly useful for `props.children`.
 *
 * ```tsx
 * function MyComponent({ children }: { children: RemixNode }) {}
 * ```
 */
export type RemixNode = Renderable | Renderable[]

export interface RemixProps<eventTarget extends EventTarget> {
  children?: RemixNode
  on?: EventListeners<eventTarget> | undefined
  css?: 'TODO: support css properties' | undefined
  style?: 'TODO: support style properties' | undefined
}
