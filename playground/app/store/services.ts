/**
 * Live, non-reactive objects shared across the app.
 *
 * These are deliberately kept *out* of the store's reactive state: they are
 * large, mutable, identity-stable singletons (Monaco itself, its text models,
 * the virtual filesystem, the package manager, the worker runtime) that would
 * be meaningless to diff or clone. Thunks reach for them through the store API
 * to perform side effects; the resulting *data* changes are then published to
 * the reactive state as plain actions.
 *
 * When the filesystem changes in a way that VFS-derived views (the file tree,
 * the share payload) must observe, a thunk bumps `state.fsRevision` so those
 * subscribers re-render — the VFS object reference itself never changes.
 */
import type * as almost from '@jacob-ebey/almostnode'
import type * as monacoTypes from 'monaco-editor'

import type { WorkerRuntime } from '../worker-runtime.ts'

let nextServerPort = 44100

export interface Services {
  /** Monaco namespace, once the editor bundle has loaded. */
  monaco: typeof monacoTypes | null

  /**
   * Editor text models, keyed by absolute path. The app owns these: it creates
   * them lazily from file contents, keeps them alive across selections, and
   * decides which one is active. Monaco is purely a renderer.
   */
  readonly models: Map<string, monacoTypes.editor.ITextModel>

  /** In-browser virtual filesystem (seeded from the project's files). */
  vfs: almost.VirtualFS | null
  /** npm-compatible package manager backed by {@link Services.vfs}. */
  npm: almost.PackageManager | null
  /** Worker runtime that executes the project's server. */
  runtime: WorkerRuntime | null

  /** Unique virtual-server port used by this app's preview iframe. */
  serverPort: number

  /** Preview iframe for this app instance, registered by the Layout component. */
  previewFrame: HTMLIFrameElement | null
  /** Share dialog for this app instance, registered by the ShareDialog component. */
  shareDialog: HTMLDialogElement | null
  /** Last same-origin route loaded in the preview iframe. */
  lastPreviewPath: string

  /**
   * Debounce handle for the editor revalidation pass. Lives here because it is
   * a transient timer, not application state.
   */
  revalidateHandle: ReturnType<typeof setTimeout> | null
}

/** Construct the initial (empty) service bag. */
export function createServices(): Services {
  return {
    monaco: null,
    models: new Map(),
    vfs: null,
    npm: null,
    runtime: null,
    serverPort: nextServerPort++,
    previewFrame: null,
    shareDialog: null,
    lastPreviewPath: '/',
    revalidateHandle: null,
  }
}
