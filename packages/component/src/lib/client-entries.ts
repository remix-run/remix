import type { Handle, NoContext, RemixNode } from './component.ts'

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
export type SerializableProps = {
  [K in string]: SerializableValue
}

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
export type EntryComponent<context = NoContext, setup = undefined, props = {}> = ((
  handle: Handle<context>,
  setup: setup,
) => (props: props) => RemixNode) &
  EntryMetadata

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
 *   (handle: Handle, setup: number) {
 *     let count = setup
 *
 *     return ({ label }: { label: string }) => (
 *       <button
 *         type="button"
 *         mix={[
 *           on('click', () => {
 *             count++
 *             handle.update()
 *           }),
 *         ]}
 *       >
 *         {label} {count}
 *       </button>
 *     )
 *   }
 * )
 * ```
 */
export function clientEntry<
  context = NoContext,
  setup extends SerializableValue = undefined,
  props extends SerializableProps = {},
>(
  entryId: string,
  component: (handle: Handle<context>, setup: setup) => (props: props) => RemixNode,
): EntryComponent<context, setup, props>

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
