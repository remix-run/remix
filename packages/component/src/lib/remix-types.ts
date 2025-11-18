import type { EventListeners } from '@remix-run/interaction'
import type { CSSProps } from './style/lib/style'
import type {
  VirtualRoot as VirtualRoot_,
  VirtualRootOptions as VirtualRootOptions_,
} from './vdom.ts'
import type { Handle as Handle_, NoContext } from './component.ts'

declare global {
  namespace Remix {
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
    export interface Element {
      type: ElementType
      props: ElementProps
      key?: string | undefined
      $rmx: true
    }

    /**
     * Any single value Remix can render. Booleans render as empty text.
     */
    export type Renderable = Element | string | number | bigint | boolean | null | undefined

    /**
     * Anything that Remix can render, including arrays of renderable values.
     * Particularly useful for `props.children`.
     *
     * ```tsx
     * function MyComponent({ children }: { children: Remix.Node }) {}
     * ```
     */
    export type Node = Renderable | Renderable[]

    export interface HostProps<eventTarget extends EventTarget> {
      children?: Node
      on?: EventListeners<eventTarget> | undefined
      css?: CSSProps
      connect?: (node: eventTarget, signal: AbortSignal) => void
    }

    /**
     * Get the props for a specific element type with normalized `on` prop.
     *
     * @example
     * interface MyButtonProps extends Props<"button"> {
     *   size: "sm" | "md" | "lg"
     * }
     *
     * @example
     * function Button({ on, ...rest }: Props<"button">) {
     *   return <button {...rest} on={{ ...on, click: handler }} />
     * }
     */
    export type Props<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T]

    export type VirtualRoot = VirtualRoot_

    export type VirtualRootOptions = VirtualRootOptions_

    export type Handle<context = NoContext> = Handle_<context>

    export type ComponentProps<T = Function> = T extends {
      (props: infer setupProps): infer renderFn
    }
      ? renderFn extends (props: infer updateProps) => any
        ? setupProps & updateProps
        : setupProps
      : never
  }
}
