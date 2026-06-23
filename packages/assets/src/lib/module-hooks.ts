export interface ModuleHooks {
  load?: ModuleLoadHook
  resolve?: ModuleResolveHook
}

export type ModuleResolveHook = (
  specifier: string,
  context: ModuleResolveContext,
  nextResolve: ModuleResolveHookNext,
) => ModuleResolveResult

export type ModuleResolveHookNext = (
  specifier: string,
  context?: Partial<ModuleResolveContext>,
) => ModuleResolveResult

export interface ModuleResolveContext {
  conditions: string[]
  importAttributes: Record<string, string | undefined>
  parentURL: string | undefined
}

export interface ModuleResolveResult {
  format?: string | null
  importAttributes?: Record<string, string | undefined>
  shortCircuit?: boolean
  url: string
}

export type ModuleLoadHook = (
  url: string,
  context: ModuleLoadContext,
  nextLoad: ModuleLoadHookNext,
) => ModuleLoadResult

export type ModuleLoadHookNext = (
  url: string,
  context?: Partial<ModuleLoadContext>,
) => ModuleLoadResult

export interface ModuleLoadContext {
  conditions: string[]
  format: string | null | undefined
  importAttributes: Record<string, string | undefined>
  /**
   * Public URL path that the asset server uses for this module.
   */
  moduleUrl?: string
}

export interface ModuleLoadResult {
  format: string | null | undefined
  shortCircuit?: boolean
  source?: string | ArrayBuffer | NodeJS.TypedArray
}

export function normalizeModuleHooks(
  rootHooks: readonly ModuleHooks[] | undefined,
  scopedHooks: readonly ModuleHooks[] | undefined,
): readonly ModuleHooks[] {
  if (rootHooks === undefined) return scopedHooks ?? []
  if (scopedHooks === undefined) return rootHooks
  return [...rootHooks, ...scopedHooks]
}
