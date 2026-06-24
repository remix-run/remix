/**
 * Thunks: the app's side-effecting operations.
 *
 * Each function here takes the store {@link AppStoreApi} (or returns an
 * {@link AppThunk} the component dispatches), reaches into the live
 * {@link Services} to touch Monaco / the VFS / the runtime, and dispatches
 * plain {@link actions} to publish the resulting data changes. Components never
 * mutate Monaco or the filesystem directly — they dispatch these.
 */
import type * as almost from '@jacob-ebey/almostnode'
import type * as monacoTypes from 'monaco-editor'
import { parse } from 'remix/data-schema'

import { SharedProjectSchema, type SharedProjectFile } from '../../backend/actions/models.ts'
import { routes } from '../../backend/routes.ts'
import { languageFor, normalizePath } from '../lib/paths.ts'
import { monacoPromise } from '../monaco.tsx'
import { templateFiles as defaultTemplateFiles, type TemplateFile } from '../templates/default.ts'
import { actions, type AppStoreApi, type AppThunk } from './index.ts'
import type { Diagnostic } from './state.ts'

const SERVER_ENTRY = 'server.ts'

export type InitialFiles =
  | Record<string, TemplateFile>
  | (() => Promise<Record<string, TemplateFile>>)

/**
 * Environment flag read by the database driver (app/db/driver.ts) to decide
 * whether to apply migrations on startup. We set it only for explicit migration
 * runs (initial boot + the Database menu) so that the constant server re-runs
 * triggered by editing don't re-apply migrations to the live database.
 */
const MIGRATE_ENV = 'MIGRATE_DATABASE'

type ServerBridge = ReturnType<typeof almost.getServerBridge>

// ---------------------------------------------------------------------------
// Boot phases
// ---------------------------------------------------------------------------

/** Phase 1: load the Monaco editor bundle. */
export const loadEditor = (): AppThunk<Promise<void>> => async (dispatch, _getState, services) => {
  try {
    services.monaco = await monacoPromise
    dispatch(actions.setEditorStatus('ready'))
  } catch (error) {
    console.error('Failed to load Monaco', error)
    dispatch(actions.setEditorStatus('failed'))
  }
}

/** Phase 2: resolve the project's files (a shared project, or the default template). */
export const loadProjectFiles =
  (initialFiles?: InitialFiles): AppThunk<Promise<void>> =>
  async (dispatch) => {
    let templateFiles = initialFiles
      ? typeof initialFiles === 'function'
        ? await initialFiles()
        : initialFiles
      : await loadDefaultInitialFiles()
    dispatch(actions.setTemplateFiles(templateFiles))
  }

async function loadDefaultInitialFiles(): Promise<Record<string, TemplateFile>> {
  let projectId = new URL(location.href).searchParams.get('project')
  return projectId
    ? (await loadSharedProjectFiles(projectId)) || defaultTemplateFiles
    : defaultTemplateFiles
}

/**
 * Phase 3: bring the runtime online once the editor and project files are
 * ready. Walks through: seed VFS → init worker → register service worker →
 * `npm install` → register the server → run the server.
 *
 * Resolves the template files from state, waiting for {@link loadProjectFiles}
 * if it hasn't published them yet.
 */
export const bootRuntime =
  (templateFilesReady: Promise<Record<string, TemplateFile>>): AppThunk<Promise<void>> =>
  async (dispatch, getState, services) => {
    let api: AppStoreApi = { dispatch, getState, services }
    await monacoPromise
    let [{ getServerBridge, PackageManager, VirtualFS }, { WorkerRuntime }] = await Promise.all([
      import('@jacob-ebey/almostnode'),
      import('../worker-runtime.ts'),
    ])

    let vfs = new VirtualFS()
    let npm = new PackageManager(vfs)
    services.vfs = vfs
    services.npm = npm

    seedVirtualFs(vfs, await templateFilesReady)

    let serverBridge = getServerBridge({
      baseUrl: `${location.protocol}//${location.host}`,
    })
    let serverPort = services.serverPort

    let runtime = new WorkerRuntime(vfs, {
      env: { PREVIEW_PORT: String(serverPort) },
      onConsole(_type, args) {
        dispatch(actions.appendConsole(args.map(String).join(' ') + '\n'))
      },
      onServerReady() {
        refreshPreviewFrame(api)
      },
    })
    services.runtime = runtime

    try {
      await runtime.execute('/* worker ready check */', '/__worker_init__.js')

      dispatch(actions.setRuntimeStatus('initializing'))
      await serverBridge.initServiceWorker({ swUrl: '/__sw__.js' })

      dispatch(actions.setRuntimeStatus('installing'))
      await installDependencies(api, npm)

      dispatch(actions.setRuntimeStatus('ready'))
      registerServer(api, serverBridge, serverPort)
    } catch (error) {
      console.error('Failed to initialize runtime', error)
      dispatch(actions.setRuntimeStatus('failed'))
    }

    if (api.getState().runtimeStatus === 'ready') {
      // First boot applies migrations so the loaded template's database is
      // usable. Subsequent re-runs (on edits) leave the schema untouched.
      runServer(api, { migrate: true })
    }
  }

/** Seed the virtual filesystem from the resolved project files. */
function seedVirtualFs(vfs: almost.VirtualFS, templateFiles: Record<string, TemplateFile>): void {
  for (let [path, file] of Object.entries(templateFiles)) {
    vfs.writeFileSync(`/${path}`, file.implementation || file.contents)
  }
}

/** Run `npm install`, streaming progress to the console. */
async function installDependencies(api: AppStoreApi, npm: almost.PackageManager): Promise<void> {
  api.dispatch(actions.appendConsole('> npm install\n'))

  let start = Date.now()
  let res = await npm.installFromPackageJson({
    onProgress: (message) => api.dispatch(actions.appendConsole(`  ${message}\n`)),
  })
  let elapsed = (Date.now() - start) / 1000
  api.dispatch(actions.appendConsole(`Installed ${res.installed.size} packages in ${elapsed}s\n`))
}

/** Register the runtime's request handler as the server for the preview frame. */
function registerServer(api: AppStoreApi, serverBridge: ServerBridge, serverPort: number): void {
  serverBridge.registerServer(
    {
      listening: true,
      address: () => ({ port: serverPort, address: 'localhost', family: 'IPv4' }),
      handleRequest: async (method, url, headers, body) =>
        api.services.runtime!.handleRequest(method, url, headers, body),
    },
    serverPort,
  )
}

function previewBasePath(serverPort: number): string {
  return `/__virtual__/${serverPort}`
}

function previewFrameSrc(serverPort: number, path: string): string {
  let basePath = previewBasePath(serverPort)
  let normalizedPath = normalizePreviewPath(path, serverPort)
  return normalizedPath === '/' ? basePath : `${basePath}${normalizedPath}`
}

function normalizePreviewPath(path: string, serverPort: number): string {
  if (!path) return '/'
  let basePath = previewBasePath(serverPort)
  let withoutVirtualPrefix = path.startsWith(`${basePath}/`)
    ? path.slice(basePath.length)
    : path === basePath
      ? '/'
      : path
  return withoutVirtualPrefix.startsWith('/') ? withoutVirtualPrefix : `/${withoutVirtualPrefix}`
}

function previewPathFromUrl(url: URL, serverPort: number): string | null {
  if (url.origin !== location.origin) return null
  return normalizePreviewPath(`${url.pathname}${url.search}${url.hash}`, serverPort)
}

/** Point the registered preview iframe at this app instance's live server. */
export function refreshPreviewFrame(api: AppStoreApi): void {
  let frame = api.services.previewFrame
  if (!frame || api.getState().runtimeStatus !== 'ready') return
  frame.src = previewFrameSrc(api.services.serverPort, api.services.lastPreviewPath)
}

/** Remember the preview iframe's current route so server re-runs reload that same page. */
export function rememberPreviewLocation(api: AppStoreApi): void {
  let frame = api.services.previewFrame
  if (!frame) return

  try {
    let href = frame.contentWindow?.location.href
    if (href) {
      let path = previewPathFromUrl(new URL(href), api.services.serverPort)
      if (path) {
        api.services.lastPreviewPath = path
        return
      }
    }
  } catch {
    // Cross-origin iframe navigations are not expected, but if one happens we
    // cannot inspect it. Fall back to the iframe's src attribute below.
  }

  let src = frame.getAttribute('src')
  if (!src) return

  try {
    let path = previewPathFromUrl(new URL(src, location.origin), api.services.serverPort)
    if (path) api.services.lastPreviewPath = path
  } catch {
    // Ignore malformed src values and keep the last known route.
  }
}

/**
 * (Re)run the server entry, resetting the console first. Surfaces syntax
 * errors in a friendly form and forwards everything else verbatim.
 *
 * Pass `migrate: true` to run pending migrations as part of this run; otherwise
 * the database driver skips migrations (see {@link MIGRATE_ENV}).
 */
export function runServer(api: AppStoreApi, { migrate = false }: { migrate?: boolean } = {}): void {
  let { runtime } = api.services
  if (!runtime) return

  rememberPreviewLocation(api)
  api.dispatch(actions.setConsole(`> node ${SERVER_ENTRY}\n`))

  // setEnv and runFile are dispatched to the worker in order and handled
  // sequentially, so the driver observes the right flag when it re-evaluates.
  runtime.setEnv({ [MIGRATE_ENV]: migrate ? '1' : undefined })
  runtime.runFile(SERVER_ENTRY).catch((error) => {
    if (
      error instanceof Error &&
      error.message.startsWith('Cannot use import statement outside a module (in') &&
      error.message.endsWith(')')
    ) {
      let badFile = error.message.slice(49, -1)
      api.dispatch(actions.appendConsole(`Syntax error: ${badFile}\n`))
      return
    }
    api.dispatch(actions.appendConsole(String(error) + '\n'))
  })
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/**
 * Run pending migrations against the live database by re-running the server
 * with the migration flag enabled. No-op until the runtime is ready.
 */
export const runMigrations = (): AppThunk => (dispatch, getState, services) => {
  let api: AppStoreApi = { dispatch, getState, services }
  if (api.getState().runtimeStatus !== 'ready') return
  runServer(api, { migrate: true })
}

/**
 * Reset the database: drop every table, then re-run the server with migrations
 * so the schema (and template seed data) is rebuilt from scratch. No-op until
 * the runtime is ready.
 */
export const resetDatabase =
  (): AppThunk<Promise<void>> => async (dispatch, getState, services) => {
    let api: AppStoreApi = { dispatch, getState, services }
    let { runtime } = services
    if (!runtime || api.getState().runtimeStatus !== 'ready') return

    await runtime.resetDatabase()
    runtime.clearCache()
    runServer(api, { migrate: true })
  }

/** Human-readable status line shown in the status bar. */
export function statusLabel(editorStatus: string, runtimeStatus: string): string {
  switch (editorStatus) {
    case 'loading':
      return 'Loading editor...'
    case 'failed':
      return 'Failed to load editor'
  }
  switch (runtimeStatus) {
    case 'initializing':
      return 'Initializing runtime...'
    case 'installing':
      return 'Installing dependencies...'
    case 'failed':
      return 'Failed to initialize runtime'
    case 'ready':
      return 'Ready'
  }
  return ''
}

// ---------------------------------------------------------------------------
// Editor models
// ---------------------------------------------------------------------------

/** Get (creating + caching as needed) the Monaco model for a file path. */
export function modelFor(api: AppStoreApi, path: string): monacoTypes.editor.ITextModel | null {
  let { services } = api
  let { monaco, vfs, models } = services
  let templateFiles = api.getState().templateFiles
  if (!templateFiles || !monaco) return null

  path = normalizePath(path)
  let existing = models.get(path)
  if (existing) return existing

  let template = templateFiles[path.slice(1)]
  let contents: string | undefined
  if (template?.readonly) {
    contents = template.contents
  } else {
    // readFileSync throws ENOENT for files that don't exist yet (e.g. a brand
    // new file from the write tool). Treat a missing file as "no model yet".
    try {
      contents = vfs?.readFileSync(path, 'utf-8')
    } catch {
      contents = undefined
    }
  }
  if (contents == null) return null

  let existingModel = monaco.editor.getModel(monaco.Uri.parse(path))
  if (existingModel) {
    models.set(path, existingModel)
    return existingModel
  }

  let model = monaco.editor.createModel(contents, languageFor(path), monaco.Uri.parse(path))
  model.onDidChangeContent(() => onModelChanged(api, path, model))
  models.set(path, model)
  return model
}

/** React to an edit in a model: enforce read-only files, otherwise persist + re-run. */
function onModelChanged(
  api: AppStoreApi,
  path: string,
  model: monacoTypes.editor.ITextModel,
): void {
  let { services } = api
  let template = api.getState().templateFiles?.[path.slice(1)]

  if (template?.readonly) {
    if (model.getValue() !== template.contents) model.setValue(template.contents)
    return
  }

  if (!services.vfs || !services.runtime) return

  services.vfs.writeFileSync(path, model.getValue())
  services.runtime.clearCache()

  if (api.getState().runtimeStatus === 'ready') runServer(api)
}

/**
 * Persist new file contents by writing through the Monaco model (via
 * {@link modelFor}). Updating the model keeps the editor in sync and its
 * onDidChangeContent handler mirrors the change to the VFS and re-runs the
 * server. Rejects read-only files and surfaces the file in the UI.
 */
export function persistFileContents(
  api: AppStoreApi,
  path: string,
  contents: string,
): { error?: string } {
  let { services, dispatch } = api
  if (!services.vfs) return { error: 'Tool call failed. Filesystem is not ready.' }

  path = normalizePath(path)
  let template = api.getState().templateFiles?.[path.slice(1)]
  if (template?.readonly) {
    return {
      error: `Tool call failed. ${path} is a read-only file and cannot be modified. Do not retry.`,
    }
  }

  let model = services.models.get(path) ?? modelFor(api, path)
  if (!model) {
    // New file: seed the VFS so a model can be created, then create it.
    services.vfs.writeFileSync(path, contents)
    model = modelFor(api, path)
    services.runtime?.clearCache()
    dispatch(actions.touchFs())
    if (api.getState().runtimeStatus === 'ready') runServer(api)
  } else if (model.getValue() !== contents) {
    // Existing file: replace the full contents via an undoable edit operation
    // (rather than setValue, which wipes the undo stack) so the user can
    // ctrl-z a tool's change just like a manual one. The model's
    // onDidChangeContent handler mirrors the change to the VFS and re-runs.
    model.pushEditOperations(
      null,
      [{ range: model.getFullModelRange(), text: contents }],
      () => null,
    )
  }

  // The change above bypasses the editor's incremental validation path, so make
  // the editor re-run its language checks and refresh markers across all files.
  scheduleEditorRevalidation(api)

  dispatch(actions.openFile(path))
  return {}
}

/** Handle the `write` tool: create or overwrite a file. */
export function writeFileForTool(
  api: AppStoreApi,
  path: string,
  content: string,
): { error?: string } {
  return persistFileContents(api, path, content)
}

/**
 * Handle the `edit` tool: apply exact text replacements. Every edit's oldText
 * is located in the *original* file contents (so the result is independent of
 * the order edits arrive in), must be unique, and must not overlap any other
 * edit's matched range. The replacements are then spliced in a single pass.
 */
export function editFileForTool(
  api: AppStoreApi,
  path: string,
  edits: { oldText: string; newText: string }[],
): { error?: string } {
  let { services, dispatch } = api
  if (!services.vfs) return { error: 'Tool call failed. Filesystem is not ready.' }
  if (!services.monaco) return { error: 'Tool call failed. Editor is not ready.' }

  path = normalizePath(path)
  let template = api.getState().templateFiles?.[path.slice(1)]
  if (template?.readonly) {
    return {
      error: `Tool call failed. ${path} is a read-only file and cannot be modified. Do not retry.`,
    }
  }

  // Read current contents from the model (the editor's source of truth).
  let model = modelFor(api, path)
  if (!model) return { error: `Tool call failed. File not found: ${path}` }
  let current = model.getValue()

  // Resolve every edit to a [start, end) range in the original contents,
  // validating that each match exists and is unique.
  let ranges: { start: number; end: number; newText: string; index: number }[] = []
  for (let [index, { oldText, newText }] of edits.entries()) {
    let first = current.indexOf(oldText)
    if (first === -1) {
      return { error: `Tool call failed. edits[${index}].oldText not found in ${path}.` }
    }
    if (current.indexOf(oldText, first + 1) !== -1) {
      return { error: `Tool call failed. edits[${index}].oldText is not unique in ${path}.` }
    }
    ranges.push({ start: first, end: first + oldText.length, newText, index })
  }

  // Validate in ascending order, rejecting any overlap between matched ranges,
  // then convert each offset range into a Monaco edit operation.
  ranges.sort((a, b) => a.start - b.start)
  let cursor = 0
  let operations: monacoTypes.editor.IIdentifiedSingleEditOperation[] = []
  for (let range of ranges) {
    if (range.start < cursor) {
      return { error: `Tool call failed. edits[${range.index}] overlaps another edit in ${path}.` }
    }
    cursor = range.end
    let startPos = model.getPositionAt(range.start)
    let endPos = model.getPositionAt(range.end)
    operations.push({
      range: new services.monaco.Range(
        startPos.lineNumber,
        startPos.column,
        endPos.lineNumber,
        endPos.column,
      ),
      text: range.newText,
    })
  }

  // Apply all operations as a single undoable edit so the user can ctrl-z a
  // tool's change just like a manual one (rather than setValue, which wipes the
  // undo stack). The model's onDidChangeContent handler mirrors the change to
  // the VFS and re-runs the server.
  model.pushEditOperations(null, operations, () => null)

  // The change above bypasses the editor's incremental validation path, so make
  // the editor re-run its language checks and refresh markers across all files.
  scheduleEditorRevalidation(api)

  dispatch(actions.openFile(path))
  return {}
}

// ---------------------------------------------------------------------------
// File open / close / create / rename / delete (dispatchable thunks)
// ---------------------------------------------------------------------------

/** Open a file in the editor (creating its model on demand). */
export const openFile =
  (path: string): AppThunk =>
  (dispatch, getState, services) => {
    let api: AppStoreApi = { dispatch, getState, services }
    path = normalizePath(path)
    if (path === api.getState().activePath) return
    if (!modelFor(api, path)) return
    api.dispatch(actions.openFile(path))
  }

/** Close a tab, choosing a sensible neighbor to activate. */
export const closeTab =
  (name: string): AppThunk =>
  (dispatch, getState, services) => {
    let api: AppStoreApi = { dispatch, getState, services }
    name = normalizePath(name)
    let state = api.getState()
    let open = [...state.openFiles]
    let index = open.findIndex((f) => f === name)
    let nextActive =
      index > 0 ? open[index - 1] : index < open.length - 1 ? open[index + 1] : undefined
    let openFiles = open.filter((f) => f !== name)
    api.dispatch(actions.setOpenFiles(openFiles))
    if (name === state.activePath) api.dispatch(actions.setActivePath(nextActive))
  }

/**
 * Create a new file or folder. Folders are materialized via `mkdirSync` and
 * files are seeded with empty contents (then opened). The `name` may contain
 * "/" to create nested paths.
 */
export const createEntry =
  (name: string, kind: 'file' | 'dir' | undefined): AppThunk =>
  (dispatch, getState, services) => {
    let api: AppStoreApi = { dispatch, getState, services }
    let { vfs } = api.services
    if (!vfs) return

    let path = normalizePath(name)
    if (path === '/') return

    if (kind === 'dir') {
      try {
        vfs.mkdirSync(path, { recursive: true })
      } catch (error) {
        console.error('Failed to create folder', error)
        return
      }
      api.services.runtime?.clearCache()
      api.dispatch(actions.touchFs())
      return
    }

    // File: seed empty contents and open it. persistFileContents creates the
    // model and writes through to the VFS, whose writeFileSync creates any
    // intermediate folders along the way. Switch to the editor so the freshly
    // created file is visible (it sets the active path + tab).
    api.dispatch(actions.setEditorView('editor'))
    persistFileContents(api, path, '')
    api.dispatch(actions.touchFs())
  }

/** Rename/move a file or folder, re-pointing open models, tabs, and the active selection. */
export const renameFile =
  (fromPath: string, name: string): AppThunk =>
  (dispatch, getState, services) => {
    let api: AppStoreApi = { dispatch, getState, services }
    let { vfs, models } = api.services
    if (!vfs) return
    let state = api.getState()

    let from = normalizePath(fromPath)
    let template = state.templateFiles?.[from.slice(1)]
    if (template?.readonly) return

    // Resolve the new name relative to the original's parent directory unless it
    // already contains a path separator.
    let parent = from.slice(0, from.lastIndexOf('/'))
    let to = normalizePath(name.includes('/') ? name : `${parent}/${name}`)
    if (to === from || to === '/') return

    // Drop models under the old path first: Monaco identifies models by URI, so
    // they must be recreated from the new path on the next render.
    forgetModels(models, from)

    // renameSync creates any intermediate folders for the destination.
    try {
      vfs.renameSync(from, to)
    } catch (error) {
      console.error('Failed to rename entry', error)
      return
    }

    let prefix = `${from}/`
    let remap = (p: string) =>
      p === from ? to : p.startsWith(prefix) ? to + p.slice(from.length) : p
    api.dispatch(actions.setOpenFiles(state.openFiles.map(remap)))
    if (state.activePath) api.dispatch(actions.setActivePath(remap(state.activePath)))

    api.services.runtime?.clearCache()
    api.dispatch(actions.touchFs())
    if (api.getState().runtimeStatus === 'ready') runServer(api)
  }

/** Delete a file or folder, closing any open tabs underneath it. */
export const deleteFile =
  (targetPath: string): AppThunk =>
  (dispatch, getState, services) => {
    let api: AppStoreApi = { dispatch, getState, services }
    let { vfs, models } = api.services
    if (!vfs) return
    let state = api.getState()

    let path = normalizePath(targetPath)
    let template = state.templateFiles?.[path.slice(1)]
    if (template?.readonly) return

    forgetModels(models, path)

    try {
      rmRecursive(vfs, path)
    } catch (error) {
      console.error('Failed to delete entry', error)
      return
    }

    let prefix = `${path}/`
    let openFiles = state.openFiles.filter((p) => p !== path && !p.startsWith(prefix))
    api.dispatch(actions.setOpenFiles(openFiles))
    if (state.activePath && (state.activePath === path || state.activePath.startsWith(prefix))) {
      api.dispatch(actions.setActivePath(openFiles[0]))
    }

    api.services.runtime?.clearCache()
    api.dispatch(actions.touchFs())
    if (api.getState().runtimeStatus === 'ready') runServer(api)
  }

/** Dispose and forget every cached model at `path` or beneath it. */
function forgetModels(models: Map<string, monacoTypes.editor.ITextModel>, path: string): void {
  let prefix = `${path}/`
  for (let key of [...models.keys()]) {
    if (key === path || key.startsWith(prefix)) {
      models.get(key)?.dispose()
      models.delete(key)
    }
  }
}

/** Recursively remove a file or directory from the VFS (the VFS only removes empty dirs). */
function rmRecursive(vfs: almost.VirtualFS, path: string): void {
  let stats = vfs.statSync(path)
  if (stats?.isDirectory()) {
    for (let entry of vfs.readdirSync(path) || []) {
      rmRecursive(vfs, `${path}/${entry}`)
    }
    vfs.rmdirSync(path)
  } else {
    vfs.unlinkSync(path)
  }
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

/** Walk the VFS (skipping node_modules) and collect files for sharing. */
function gatherSharedFiles(api: AppStoreApi, path = ''): SharedProjectFile[] {
  let { vfs } = api.services
  let templateFiles = api.getState().templateFiles
  if (!vfs) return []

  let results: SharedProjectFile[] = []
  for (let entry of vfs.readdirSync(path) || []) {
    if (entry === 'node_modules') continue

    let fullPath = `${path}/${entry}`
    let stats = vfs.statSync(fullPath)
    if (stats?.isDirectory()) {
      results.push(...gatherSharedFiles(api, fullPath))
      continue
    }

    let template = templateFiles?.[fullPath.slice(1)]
    results.push({
      name: fullPath.slice(1),
      contents: template?.readonly ? template.contents : vfs.readFileSync(fullPath, 'utf-8'),
      implementation: template?.implementation,
      readonly: template?.readonly || false,
    })
  }
  return results
}

/** Upload the current project and surface a shareable link. */
export const shareProject =
  (signal: AbortSignal): AppThunk<Promise<void>> =>
  async (dispatch, getState, services) => {
    let api: AppStoreApi = { dispatch, getState, services }
    api.dispatch(actions.setSharing(true))
    api.dispatch(actions.setSharedId(null))

    try {
      let files = gatherSharedFiles(api)
      let response = await fetch(routes.shareProject.href(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
        signal,
      })

      if (signal.aborted) return

      let json = await response.json()
      if (
        typeof json === 'object' &&
        json !== null &&
        'projectId' in json &&
        typeof json.projectId === 'string'
      ) {
        api.dispatch(actions.setSharedId(json.projectId))
      }
    } finally {
      if (!signal.aborted) api.dispatch(actions.setSharing(false))
    }
  }

function loadSharedProjectFiles(projectId: string): Promise<Record<string, TemplateFile> | null> {
  return fetch(routes.loadSharedProject.href({ projectId }))
    .then((res) => res.json())
    .then((json) => parse(SharedProjectSchema, json))
    .then(({ files }) =>
      Object.fromEntries(
        files.map((file) => [
          file.name,
          {
            contents: file.contents,
            readonly: file.readonly,
            implementation: file.implementation,
          } satisfies TemplateFile,
        ]),
      ),
    )
    .catch(() => null)
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * Force a fresh validation pass and refresh `state.diagnostics`.
 *
 * We deliberately bypass Monaco's marker service here: markers are written by
 * the language adapters, which debounce model changes by ~500ms and only
 * re-validate the single model that changed. Instead we query the TS/JS
 * language workers directly for every open model (the worker keeps one program
 * across all synced models), giving a deterministic, debounce-free signal with
 * no cross-file staleness. CSS/JSON/HTML diagnostics are folded in from the
 * marker service.
 */
export const awaitDiagnostics =
  (): AppThunk<Promise<void>> => async (dispatch, getState, services) => {
    let api: AppStoreApi = { dispatch, getState, services }
    let { monaco, models } = api.services
    if (!monaco) return

    try {
      let open = [...models.values()].filter((model) => !model.isDisposed())
      let tsModels = open.filter((model) => model.getLanguageId() === 'typescript')
      let jsModels = open.filter((model) => model.getLanguageId() === 'javascript')

      let diagnostics: Diagnostic[] = []

      let drive = async (
        getWorker: (...uris: monacoTypes.Uri[]) => Promise<monacoTypes.typescript.TypeScriptWorker>,
        list: monacoTypes.editor.ITextModel[],
      ) => {
        let worker = await getWorker(...list.map((model) => model.uri))
        await Promise.all(
          list.map(async (model) => {
            let fileName = model.uri.toString()
            let [syntactic, semantic] = await Promise.all([
              worker.getSyntacticDiagnostics(fileName),
              worker.getSemanticDiagnostics(fileName),
            ])
            if (model.isDisposed()) return
            for (let diag of [...syntactic, ...semantic]) {
              let pos = model.getPositionAt(diag.start ?? 0)
              diagnostics.push({
                path: model.uri.path,
                severity: tsCategorySeverity(diag.category),
                message: flattenTsMessage(diag.messageText),
                line: pos.lineNumber,
                column: pos.column,
              })
            }
          }),
        )
      }

      let tasks: Promise<unknown>[] = []
      if (tsModels.length) {
        tasks.push(
          monaco.typescript
            .getTypeScriptWorker()
            .then((getWorker) => drive(getWorker, tsModels))
            .catch((error) => console.error('Failed to refresh TS diagnostics', error)),
        )
      }
      if (jsModels.length) {
        tasks.push(
          monaco.typescript
            .getJavaScriptWorker()
            .then((getWorker) => drive(getWorker, jsModels))
            .catch((error) => console.error('Failed to refresh JS diagnostics', error)),
        )
      }
      await Promise.all(tasks)

      // Fold in non-TS/JS diagnostics (CSS/JSON/HTML) from the marker service.
      for (let marker of monaco.editor.getModelMarkers({})) {
        if (marker.owner === 'typescript' || marker.owner === 'javascript') continue
        diagnostics.push({
          path: marker.resource.path,
          severity: markerSeverity(monaco, marker.severity),
          message: marker.message,
          line: marker.startLineNumber,
          column: marker.startColumn,
        })
      }

      api.dispatch(actions.setDiagnostics(diagnostics))
    } catch (error) {
      console.error('Failed to refresh diagnostics', error)
    }
  }

/**
 * Force the editor to re-validate every open model and refresh its on-screen
 * markers, debounced to coalesce a burst of edits into one pass.
 */
function scheduleEditorRevalidation(api: AppStoreApi): void {
  let { services } = api
  if (!services.monaco) return
  if (services.revalidateHandle) clearTimeout(services.revalidateHandle)
  services.revalidateHandle = setTimeout(() => {
    services.revalidateHandle = null
    revalidateOpenModels(api)
  }, 50)
}

/** Re-fire each language's diagnostics options, prompting a full revalidation. */
function revalidateOpenModels(api: AppStoreApi): void {
  let { monaco } = api.services
  if (!monaco) return
  for (let defaults of [
    monaco.typescript.typescriptDefaults,
    monaco.typescript.javascriptDefaults,
  ]) {
    defaults.setDiagnosticsOptions(defaults.getDiagnosticsOptions())
  }
}

/** Map a TypeScript `DiagnosticCategory` to our severity vocabulary. */
function tsCategorySeverity(category: number): Diagnostic['severity'] {
  // ts.DiagnosticCategory: Warning = 0, Error = 1, Suggestion = 2, Message = 3.
  switch (category) {
    case 1:
      return 'error'
    case 0:
      return 'warning'
    case 2:
      return 'hint'
    default:
      return 'info'
  }
}

/** Map a Monaco marker severity to our severity vocabulary. */
function markerSeverity(
  monaco: typeof monacoTypes,
  severity: monacoTypes.MarkerSeverity,
): Diagnostic['severity'] {
  switch (severity) {
    case monaco.MarkerSeverity.Error:
      return 'error'
    case monaco.MarkerSeverity.Warning:
      return 'warning'
    case monaco.MarkerSeverity.Info:
      return 'info'
    default:
      return 'hint'
  }
}

/** A nested TypeScript diagnostic message chain (Monaco doesn't export the type). */
interface DiagnosticMessageChain {
  messageText: string
  next?: DiagnosticMessageChain[]
}

/** Flatten a TS diagnostic message (a string or a nested message chain) to text. */
function flattenTsMessage(messageText: string | DiagnosticMessageChain, indent = 0): string {
  if (typeof messageText === 'string') return messageText
  let result = `${'  '.repeat(indent)}${messageText.messageText}`
  for (let next of messageText.next ?? []) {
    result += `\n${flattenTsMessage(next, indent + 1)}`
  }
  return result
}
