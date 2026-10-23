import { createRequire } from 'node:module'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Database } from '@remix-run/data-table'

import { dbModuleFactoryRequired, dbModuleNotFound } from './errors.ts'
import type { RemixDbAdapterConfig } from './remix-config.ts'

export type RemixDbModuleAdapterConfig = Extract<RemixDbAdapterConfig, { type: 'module' }>

/**
 * Values a `db.adapter` module receives when the Remix CLI asks it for a
 * database.
 */
export interface RemixDbModuleContext {
  /** Directory that contains the `remix.json` naming the module. */
  configDir: string
  /**
   * Connection value resolved from `db.adapter.connection` or the
   * `--connection-env` option. Undefined when neither is configured.
   */
  connection?: string
  /** Values passed through from `db.adapter.options`. */
  options?: Record<string, unknown>
}

/**
 * Database factory a `db.adapter` module exports so `remix db` can drive a
 * database the CLI does not ship an adapter for.
 *
 * The CLI closes the returned database when the command finishes.
 */
export type RemixDbModuleFactory = (
  context: RemixDbModuleContext,
) => Database | PromiseLike<Database>

/**
 * Imports a `db.adapter` module and calls its database factory.
 *
 * @param adapter Module adapter configuration.
 * @param configDir Directory that contains the `remix.json`.
 * @param connection Connection value for the factory, if one is configured.
 * @returns The database the module created.
 */
export async function createModuleDatabase(
  adapter: RemixDbModuleAdapterConfig,
  configDir: string,
  connection: string | undefined,
): Promise<Database> {
  let specifier = resolveModuleSpecifier(adapter.module, configDir)
  let exportName = adapter.export ?? 'default'
  let namespace: Record<string, unknown>

  try {
    namespace = (await import(specifier)) as Record<string, unknown>
  } catch (error) {
    throw dbModuleNotFound(adapter.module, error)
  }

  let factory = namespace[exportName]
  if (typeof factory !== 'function') {
    throw dbModuleFactoryRequired(adapter.module, exportName)
  }

  return (factory as RemixDbModuleFactory)({
    configDir,
    connection,
    options: adapter.options,
  })
}

function resolveModuleSpecifier(specifier: string, configDir: string): string {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
    return pathToFileURL(path.resolve(configDir, specifier)).href
  }

  // Specifiers that already name a scheme, such as `file:`, `jsr:`, or `npm:`,
  // are the runtime's to resolve.
  if (/^[a-z][a-z0-9+.-]*:/i.test(specifier)) return specifier

  // Bare specifiers name a dependency of the app, not of the CLI, so resolve
  // them from the config directory. Packages the CLI's own resolver can reach
  // still load from the unresolved specifier.
  try {
    return pathToFileURL(createRequire(path.join(configDir, 'package.json')).resolve(specifier))
      .href
  } catch {
    return specifier
  }
}
