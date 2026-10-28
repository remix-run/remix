import { createSchemaNode } from './schema.ts'
import type {
  BaseSchemaNode,
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
} from './schema.ts'

export type LazySchemaNode = BaseSchemaNode<'lazy'> & {
  getter: () => Schema<any, any>
  // Set the first time the schema is validated or resolved for inspection.
  resolved: Schema<any, any> | undefined
}

/**
 * Create a lazily-evaluated schema.
 *
 * This is useful for recursive schemas without circular module references.
 *
 * @param getSchema A function that returns the schema when first needed
 * @returns A schema that delegates validation to the resolved schema
 */
export function lazy<schema extends Schema<any, any>>(
  getSchema: () => schema,
): Schema<InferInput<schema>, InferOutput<schema>> {
  let node = createSchemaNode<LazySchemaNode>('lazy', runLazy)
  node.getter = getSchema
  node.resolved = undefined
  return node
}

/**
 * Returns the schema behind a lazy schema, calling its getter only once. Code that walks
 * recursive schemas should track the lazy schemas it has already visited.
 *
 * @param node The lazy schema
 * @returns The resolved schema
 */
export function resolveLazySchema(node: LazySchemaNode): Schema<any, any> {
  if (node.resolved === undefined) {
    let getter = node.getter
    node.resolved = getter()
  }

  return node.resolved
}

function runLazy(this: LazySchemaNode, value: unknown, context: ValidationContext) {
  return resolveLazySchema(this)['~run'](value, context)
}
