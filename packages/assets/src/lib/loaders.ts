type ModuleFloat16Array = typeof globalThis extends {
  Float16Array: { prototype: infer array }
}
  ? array
  : never

type ModuleTypedArray =
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | BigUint64Array
  | BigInt64Array
  | ModuleFloat16Array
  | Float32Array
  | Float64Array

type ModuleLoadSource = string | ArrayBuffer | ModuleTypedArray

/**
 * Synchronously loads a module or delegates to the next configured loader.
 *
 * Loaders follow Node's synchronous `load` hook signature and chaining contract. The asset server
 * passes them JavaScript after its TypeScript/JavaScript transform and before HMR analysis and
 * minification. Each loader must delegate to `nextLoad` or return `shortCircuit: true`.
 *
 * @param url Resolved `file:` URL for the module being compiled.
 * @param context Format, conditions, attributes, and public asset URL for this load.
 * @param nextLoad Next loader in the chain, ending with the asset server's compiled JavaScript.
 * @returns A Node-compatible load result containing ES module source.
 */
export type ModuleLoader = (
  url: string,
  context: ModuleLoadContext,
  nextLoad: NextModuleLoader,
) => ModuleLoadResult

/**
 * Continues loading through the remaining loader chain.
 *
 * Omitted context fields retain their current values.
 *
 * @param url Current module URL. Loaders cannot change this URL.
 * @param context Context fields to override for the remainder of this load.
 * @returns The source produced by the remaining loaders or the asset compiler.
 */
export type NextModuleLoader = (
  url: string,
  context?: Partial<ModuleLoadContext>,
) => ModuleLoadResult

/** State passed through a module loader chain. */
export interface ModuleLoadContext {
  /** Package export conditions used while compiling this module. */
  conditions: string[]
  /** Current module format. Asset-server loaders must ultimately return `'module'`. */
  format: string | null | undefined
  /** Import attributes supplied by the previous loader. Authored import attributes are unsupported. */
  importAttributes: Record<string, string | undefined>
  /**
   * Stable public URL path used to request this module from the asset server.
   *
   * Unlike Node's standard load context, this field is provided so loaders can use the browser
   * module identity rather than its private filesystem URL.
   */
  moduleUrl?: string
}

/** Source returned by a module loader. */
export interface ModuleLoadResult {
  /** Loaded module format. Must be `'module'` for asset-server scripts. */
  format: string | null | undefined
  /** Whether this result intentionally ends the loader chain without calling `nextLoad`. */
  shortCircuit?: boolean
  /** Compiled JavaScript source, optionally rewritten by the loader. */
  source?: ModuleLoadSource
}
