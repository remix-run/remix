/**
 * The store's reactive state: plain, serializable-ish data only.
 *
 * Live objects (Monaco, models, the VFS, the runtime) live in {@link Services}
 * instead. Anything here is safe to read in a selector and compare by reference
 * — every update produces a new top-level object via the reducer.
 */
import type { TemplateFile } from '../templates/default.ts'

/** Loading phase of the Monaco editor bundle. */
export type EditorStatus = 'loading' | 'failed' | 'ready'

/** Loading phase of the in-browser runtime (worker + npm install + server). */
export type RuntimeStatus = 'initializing' | 'installing' | 'ready' | 'failed'

/** A single LSP diagnostic, flattened to a serializable shape for chat metadata. */
export interface Diagnostic {
  path: string
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  line: number
  column: number
}

export interface AppState {
  // Editor (Monaco) bundle + runtime status.
  editorStatus: EditorStatus
  runtimeStatus: RuntimeStatus

  // Open file bookkeeping. `activePath` is the file shown in the editor;
  // `openFiles` is the ordered list of tabs (absolute, normalized paths).
  activePath: string | undefined
  openFiles: readonly string[]

  // Console / preview output.
  consoleOutput: string

  // Share dialog.
  sharing: boolean
  sharedId: string | null

  // Targets for the create / rename / delete dialogs, set when the user starts
  // a flow so the dialog renders with the right context before it opens.
  createTarget: { kind: 'file' | 'dir' } | undefined
  renameTarget: { path: string; name: string } | undefined
  deleteTarget: { path: string; type: 'file' | 'dir' } | undefined

  // Which pane the main area shows.
  editorView: 'editor' | 'chat'

  // Project files (default template or a shared project). Resolves once loaded.
  templateFiles: Record<string, TemplateFile> | null

  // Most recent diagnostic snapshot, refreshed before each chat turn.
  diagnostics: readonly Diagnostic[]

  /**
   * Monotonic counter bumped whenever the virtual filesystem changes (create,
   * rename, delete, write). VFS-derived views (the file tree) select this to
   * know when to recompute, since the VFS object itself is non-reactive.
   */
  fsRevision: number
}

const DEFAULT_ACTIVE_FILE = '/app/views/marketing/home.tsx'
const DEFAULT_OPEN_FILES = ['/app/controllers/marketing.tsx', DEFAULT_ACTIVE_FILE]

export { DEFAULT_ACTIVE_FILE, DEFAULT_OPEN_FILES }

export function createInitialState(): AppState {
  return {
    editorStatus: 'loading',
    runtimeStatus: 'initializing',
    activePath: DEFAULT_ACTIVE_FILE,
    openFiles: [...DEFAULT_OPEN_FILES],
    consoleOutput: '',
    sharing: false,
    sharedId: null,
    createTarget: undefined,
    renameTarget: undefined,
    deleteTarget: undefined,
    editorView: 'editor',
    templateFiles: null,
    diagnostics: [],
    fsRevision: 0,
  }
}
