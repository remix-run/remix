import type { Handle, NoContext, RemixNode, RenderFn } from './component.ts'

/**
 * Serializable primitive types that can be passed as props to entry components
 */
export type SerializablePrimitive = string | number | boolean | null | undefined

/**
 * Serializable object types that can be passed as props to entry components
 */
export type SerializableObject = {
  [key: string]: SerializableValue
}

/**
 * Serializable array types that can be passed as props to entry components
 */
export type SerializableArray = SerializableValue[]

/**
 * All serializable values that can be passed as props to entry components.
 * This includes primitives, objects, arrays, and Remix Elements.
 */
export type SerializableValue =
  | SerializablePrimitive
  | SerializableObject
  | SerializableArray
  | RemixNode

/**
 * Constraint that ensures all properties in an object are serializable.
 */
type SerializableProperty<value> = value extends SerializablePrimitive | RemixNode
  ? value
  : value extends (...args: never[]) => unknown
    ? never
    : value extends abstract new (...args: never[]) => object
      ? never
      : value extends readonly unknown[]
        ? { [index in keyof value]: SerializableProperty<value[index]> }
        : value extends object
          ? object extends value
            ? never
            : { [key in keyof value]: SerializableProperty<value[key]> }
          : never

export type SerializableProps<props extends object = SerializableObject> =
  props extends SerializableObject
    ? props
    : { [key in keyof props]: SerializableProperty<props[key]> }

/**
 * Metadata added to entry components
 */
export type EntryMetadata = {
  $entry: true
  $entryId: string
}

/**
 * An entry component preserves the exact function type with added metadata
 */
export type EntryComponent<props extends object = {}, context = NoContext> = [props] extends [
  SerializableProps<props>,
]
  ? ((handle: Handle<props, context>) => RenderFn) & EntryMetadata
  : never

/**
 * Marks a component as a client entry for client-side hydration.
 *
 * @param entryId Module URL with optional export name (format: "/js/module.js#ExportName") by
 * default, or a custom entry identifier when paired with `resolveClientEntry`
 * @param component Component function that will be hydrated on the client
 * @returns The component augmented with entry metadata
 *
 * @example
 * ```tsx
 * export const Counter = clientEntry(
 *   '/js/counter.js#Counter',
 *   function Counter(handle: Handle<{ initialCount?: number; label: string }>) {
 *     let count = handle.props.initialCount ?? 0
 *
 *     return () => (
 *       <button
 *         type="button"
 *         mix={[
 *           on('click', () => {
 *             count++
 *             handle.update()
 *           }),
 *         ]}
 *       >
 *         {handle.props.label} {count}
 *       </button>
 *     )
 *   }
 * )
 * ```
 */
export function clientEntry<props extends object = {}, context = NoContext>(
  entryId: string,
  component: ((handle: Handle<props, context>) => RenderFn) &
    ([props] extends [SerializableProps<props>] ? unknown : never),
): EntryComponent<props, context>

// Implementation
export function clientEntry(entryId: string, component: any): any {
  if (!entryId) {
    throw new Error('clientEntry() requires an entry ID')
  }

  // Augment the component with entry metadata
  component.$entry = true
  component.$entryId = entryId

  return component
}

/**
 * Type guard to check if a component is an entry component
 *
 * @param component The component to check
 * @returns True if the component has entry metadata
 */
export function isEntry(component: unknown): component is EntryComponent {
  return Boolean(component && typeof component === 'function' && (component as any).$entry === true)
}

/**
 * Logs a client-hydration mismatch to the console.
 *
 * @param msg Message parts to forward to the logger.
 */
export function logHydrationMismatch(...msg: any[]) {
  console.error('Hydration mismatch:', ...msg)
}

/**
 * Advances a DOM cursor past consecutive comment nodes.
 *
 * @param cursor Starting DOM node.
 * @returns The first non-comment node, or `null` when none remains.
 */
export function skipComments(cursor: Node | null): Node | null {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling
  }
  return cursor
}
