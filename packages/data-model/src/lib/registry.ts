import type { Database } from '@remix-run/data-table'

import type { Model } from './model.ts'

/**
 * Constructor type for classes that extend `Model`.
 */
export type ModelClass = typeof Model

/**
 * Input shape passed to `createModelRegistry`.
 *
 * Keys are model names and values are model classes.
 */
export type ModelDefs = Record<string, ModelClass>

/**
 * Output shape returned from `registry.bind(database)`.
 *
 * Each model class is replaced with a bound subclass.
 */
export type BoundModels<models extends ModelDefs> = {
  [name in keyof models]: models[name]
}

/**
 * Interface that binds model definitions to a database connection.
 */
export type ModelRegistry<models extends ModelDefs> = {
  bind(database: Database): BoundModels<models>
}

/**
 * Creates a model registry.
 *
 * Call `bind(database)` per request to get a registry object whose model
 * classes are bound to that database.
 *
 * @param models Model definitions to include in this registry.
 * @returns A registry with a `bind(database)` method.
 */
export function createModelRegistry<models extends ModelDefs>(
  models: models,
): ModelRegistry<models> {
  return {
    bind(database: Database): BoundModels<models> {
      let registry = {} as BoundModels<models>

      for (let name in models) {
        ;(registry as ModelDefs)[name] = models[name].bind(database)
      }

      return registry
    },
  }
}
