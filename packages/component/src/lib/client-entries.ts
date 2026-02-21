import type { Handle, NoContext, RemixNode } from './component.ts'
import type { Props } from './jsx.ts'

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
 * A style required for hydration.
 */
export type HydrationStyle = { href: string } & Omit<Props<'link'>, 'children' | 'rel'>

/**
 * A script required for hydration.
 */
export type HydrationScript = { src: string } & Omit<Props<'script'>, 'children' | 'src' | 'type'>

/**
 * Component asset loading metadata
 */
export type AssetMetadata = {
  exportName: string
  js: [HydrationScript, ...HydrationScript[]]
  css?: HydrationStyle[]
}

/**
 * Metadata added to entry components
 */
export type EntryMetadata = {
  $entry: true
  $asset: Required<AssetMetadata>
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
 * @param href Module URL with optional export name (format: "/js/module.js#ExportName")
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
 *         on={{
 *           click: () => {
 *             count++
 *             handle.update()
 *           },
 *         }}
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
  href: string | AssetMetadata,
  component: (handle: Handle<context>, setup: setup) => (props: props) => RemixNode,
): EntryComponent<context, setup, props>

// Implementation
export function clientEntry(asset: string | AssetMetadata, component: any): any {
  if (typeof asset !== 'object' || asset === null) {
    // Parse module URL and export name
    let [moduleUrl, parsedExportName] = asset?.split('#') ?? []

    if (!moduleUrl) {
      throw new Error('clientEntry() requires a module URL')
    }

    // Use component name as fallback if no export name provided
    let finalExportName = parsedExportName || component.name

    if (!finalExportName) {
      throw new Error(
        'clientEntry() requires either an exportName in the asset, a hash in a string (e.g., "/js/module.js#ComponentName") or a named component function',
      )
    }
    asset = {
      exportName: finalExportName,
      js: [{ src: moduleUrl }],
    }
  }

  if (!asset) {
    throw new Error('clientEntry() requires an asset')
  }

  // Augment the component with entry metadata
  component.$entry = true
  component.$asset = asset

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
export function logHydrationMismatch(...msg: any[]) {
  console.error('Hydration mismatch:', ...msg)
}

export function skipComments(cursor: Node | null): Node | null {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling
  }
  return cursor
}
