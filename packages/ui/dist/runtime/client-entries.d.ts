import type { Handle, NoContext, RemixNode, RenderFn } from './component.ts';
/**
 * Serializable primitive types that can be passed as props to entry components
 */
export type SerializablePrimitive = string | number | boolean | null | undefined;
/**
 * Serializable object types that can be passed as props to entry components
 */
export type SerializableObject = {
    [key: string]: SerializableValue;
};
/**
 * Serializable array types that can be passed as props to entry components
 */
export type SerializableArray = SerializableValue[];
/**
 * All serializable values that can be passed as props to entry components.
 * This includes primitives, objects, arrays, and Remix Elements.
 */
export type SerializableValue = SerializablePrimitive | SerializableObject | SerializableArray | RemixNode;
/**
 * Constraint that ensures all properties in an object are serializable.
 */
export type SerializableProps = {
    [K in string]: SerializableValue;
};
/**
 * Metadata added to entry components
 */
export type EntryMetadata = {
    $entry: true;
    $entryId: string;
};
/**
 * An entry component preserves the exact function type with added metadata
 */
export type EntryComponent<props extends SerializableProps = {}, context = NoContext> = ((handle: Handle<props, context>) => RenderFn<props>) & EntryMetadata;
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
export declare function clientEntry<props extends SerializableProps = {}, context = NoContext>(entryId: string, component: (handle: Handle<props, context>) => RenderFn): EntryComponent<props, context>;
export declare function clientEntry<props extends SerializableProps = {}, context = NoContext>(entryId: string, component: (handle: Handle<Record<string, never>, context>) => RenderFn<props>): EntryComponent<props, context>;
/**
 * Type guard to check if a component is an entry component
 *
 * @param component The component to check
 * @returns True if the component has entry metadata
 */
export declare function isEntry(component: unknown): component is EntryComponent;
/**
 * Logs a client-hydration mismatch to the console.
 *
 * @param msg Message parts to forward to the logger.
 */
export declare function logHydrationMismatch(...msg: any[]): void;
/**
 * Advances a DOM cursor past consecutive comment nodes.
 *
 * @param cursor Starting DOM node.
 * @returns The first non-comment node, or `null` when none remains.
 */
export declare function skipComments(cursor: Node | null): Node | null;
