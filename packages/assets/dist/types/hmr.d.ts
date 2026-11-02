interface ImportMetaHot {
  /** Mutable state preserved for this module across accepted updates and passed to dispose handlers. */
  readonly data: Record<string, unknown>
  /** Accepts updates to this module, optionally receiving its newly evaluated namespace. */
  accept(callback?: (module: HotModule) => HotCallbackResult): void
  /** Accepts updates from one dependency, optionally receiving its newly evaluated namespace. */
  accept(dep: string, callback?: (module: HotModule) => HotCallbackResult): void
  /**
   * Accepts updates from multiple dependencies. The callback array preserves `deps` order and
   * contains the updated namespace only at the position of the dependency that changed.
   */
  accept(
    deps: readonly string[],
    callback?: (modules: Array<HotModule | undefined>) => HotCallbackResult,
  ): void
  /** Registers cleanup that runs before this module is re-evaluated or the runtime is disposed. */
  dispose(callback: (data: Record<string, unknown>) => HotCallbackResult): void
  /** Declines the current update and reloads the page if no importing boundary accepts it. */
  invalidate(message?: string): void
  /** Registers a listener for custom events from the browser HMR channel. */
  on(event: string, callback: (data: unknown) => void | Promise<void>): void
}

type HotModule = Readonly<Record<string, unknown>> & {
  readonly [Symbol.toStringTag]: 'Module'
}

type HotCallbackResult = void | Promise<void>

declare global {
  interface ImportMeta {
    readonly hot?: ImportMetaHot
  }
}

export {}
