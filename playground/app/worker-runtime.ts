/**
 * WorkerRuntime - Runs code in a Web Worker for non-blocking execution
 *
 * This class provides the same IRuntime interface as Runtime,
 * but executes code in a separate Web Worker thread.
 */

import { proxy, type Remote, wrap } from 'comlink'
import type { VirtualFS } from '@jacob-ebey/almostnode'
import type { IExecuteResult, IRuntime, IRuntimeOptions, VFSSnapshot } from '@jacob-ebey/almostnode'

import RuntimeWorker from './runtime-worker.ts?worker'

/**
 * Type for the worker API
 */
interface WorkerApi {
  init(vfsSnapshot: VFSSnapshot, options: IRuntimeOptions): void
  setConsoleCallback(callback: ((method: string, args: unknown[]) => void) | null): void
  setServerReadyCallback(callback: ((port: number) => void) | null): void
  setEnv(env: Record<string, string | undefined>): void
  resetDatabase(): void
  syncFile(path: string, content: string | null): void
  execute(code: string, filename?: string): Promise<IExecuteResult>
  runFile(filename: string): Promise<IExecuteResult>
  clearCache(): void
  getVFSSnapshot(): VFSSnapshot | null
  handleRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: any,
  ): Promise<{
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: any
  }>
}

/**
 * WorkerRuntime - Executes code in a Web Worker
 */
export class WorkerRuntime implements IRuntime {
  #worker: Worker
  #workerApi: Remote<WorkerApi>
  #vfs: VirtualFS
  #options: IRuntimeOptions & {
    onServerReady?: (port: number) => void
  }
  #initialized: Promise<void>
  #changeListener: ((path: string, content: string) => void) | null = null
  #deleteListener: ((path: string) => void) | null = null

  constructor(
    vfs: VirtualFS,
    options: IRuntimeOptions & {
      onServerReady?: (port: number) => void
    } = {},
  ) {
    this.#vfs = vfs
    this.#options = options

    // Create the worker
    // Using Vite's worker import syntax
    this.#worker = new RuntimeWorker()

    // Wrap with Comlink
    this.#workerApi = wrap<WorkerApi>(this.#worker)

    // Initialize the worker
    this.#initialized = this.#initWorker()

    // Set up VFS change listeners
    this.#setupVFSListeners()
  }

  /**
   * Initialize the worker with VFS snapshot and options
   */
  async #initWorker(): Promise<void> {
    let snapshot = this.#vfs.toSnapshot()

    // Create options without the onConsole callback (we'll set it separately via proxy)
    let workerOptions: IRuntimeOptions = {
      cwd: this.#options.cwd,
      env: this.#options.env,
    }

    await this.#workerApi.init(snapshot, workerOptions)

    // Set up console forwarding if callback provided
    if (this.#options.onConsole) {
      await this.#workerApi.setConsoleCallback(proxy(this.#options.onConsole))
    }

    if (this.#options.onServerReady) {
      await this.#workerApi.setServerReadyCallback(proxy(this.#options.onServerReady))
    }

    if (this.#options.onServerReady) {
      await this.#workerApi.setServerReadyCallback(proxy(this.#options.onServerReady))
    }

    console.log('[WorkerRuntime] Worker initialized')
  }

  /**
   * Set up listeners for VFS changes to sync to worker
   */
  #setupVFSListeners(): void {
    // Listen for file changes
    this.#changeListener = (path: string, content: string) => {
      this.#workerApi.syncFile(path, content)
    }
    this.#vfs.on('change', this.#changeListener)

    // Listen for file deletions
    this.#deleteListener = (path: string) => {
      this.#workerApi.syncFile(path, null)
    }
    this.#vfs.on('delete', this.#deleteListener)
  }

  /**
   * Execute code in the worker
   */
  async execute(code: string, filename?: string): Promise<IExecuteResult> {
    await this.#initialized
    return this.#workerApi.execute(code, filename)
  }

  /**
   * Run a file from the VFS in the worker
   */
  async runFile(filename: string): Promise<IExecuteResult> {
    await this.#initialized
    return this.#workerApi.runFile(filename)
  }

  /**
   * Update environment variables on the worker's running process.
   */
  async setEnv(env: Record<string, string | undefined>): Promise<void> {
    await this.#initialized
    await this.#workerApi.setEnv(env)
  }

  /**
   * Drop every user table from the in-memory database in the worker.
   */
  async resetDatabase(): Promise<void> {
    await this.#initialized
    await this.#workerApi.resetDatabase()
  }

  /**
   * Clear the module cache in the worker
   */
  clearCache(): void {
    this.#workerApi.clearCache()
  }

  /**
   * Get the VFS (main thread instance)
   */
  getVFS(): VirtualFS {
    return this.#vfs
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    // Remove VFS listeners
    if (this.#changeListener) {
      this.#vfs.off('change', this.#changeListener)
    }
    if (this.#deleteListener) {
      this.#vfs.off('delete', this.#deleteListener)
    }

    // Terminate the worker
    this.#worker.terminate()
    console.log('[WorkerRuntime] Worker terminated')
  }

  async handleRequest(method: string, url: string, headers: Record<string, string>, body?: any) {
    return this.#workerApi.handleRequest(method, url, headers, body)
  }
}
