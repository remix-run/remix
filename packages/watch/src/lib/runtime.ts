// runtime.ts - HMR runtime for server-side hot module replacement

// Re-export core HMR runtime from component-hmr
export {
  __hmr_state,
  __hmr_clear_state,
  __hmr_register,
  __hmr_call,
  __hmr_register_component,
  __hmr_get_component,
  __hmr_update,
  __hmr_setup,
  __hmr_get_tracked_handle_count,
} from '@remix-run/component-hmr/runtime'

// Module registry for HMR tracking
interface ModuleInfo {
  url: string
  filePath: string
  isComponent: boolean
  importers: Set<string>
  imports: Set<string> // Track what this module imports (for cleanup during HMR)
}

let moduleRegistry = new Map<string, ModuleInfo>()
let currentImporter: string | null = null
let hmrSetupComplete = false

// Register a module in the runtime's registry.
// Called automatically by the loader's injected code when modules load.
// After initial setup, new modules discovered during HMR are sent to the supervisor immediately.
// importsFromLoader: Array of URLs that this module imports (parsed statically from code)
export function registerModule(
  url: string,
  filePath: string,
  isComponent: boolean = false,
  importsFromLoader: string[] = [],
) {
  // Strip query strings and hashes for stable module identity (HMR uses ?t=timestamp)
  let normalizedUrl = url.split('?')[0].split('#')[0]
  let normalizedCurrentImporter = currentImporter
    ? currentImporter.split('?')[0].split('#')[0]
    : null

  let isNewModule = !moduleRegistry.has(normalizedUrl)
  let entry: ModuleInfo
  let importersChanged = false

  if (isNewModule) {
    entry = {
      url: normalizedUrl,
      filePath,
      isComponent,
      importers: new Set(),
      imports: new Set(),
    }
    moduleRegistry.set(normalizedUrl, entry)
  } else {
    entry = moduleRegistry.get(normalizedUrl)!
    let previousImportersSize = entry.importers.size
    let wasComponent = entry.isComponent

    // Capture old imports to detect which were removed
    let oldImports = new Set(entry.imports)

    // Clean up old import relationships when re-registering during HMR
    // Remove this module from its previous imports' importers
    for (let previousImport of entry.imports) {
      let previousImportEntry = moduleRegistry.get(previousImport)
      if (previousImportEntry) {
        previousImportEntry.importers.delete(normalizedUrl)
        // Note: We don't send module-update here during cleanup because the importer
        // relationships will be re-established when imports are re-registered.
        // Sending now would send stale data (empty importers) before they're rebuilt.
      }
    }
    // Clear imports - will be rebuilt as new imports are registered
    entry.imports.clear()

    // Update component flag if it changed (e.g., module was transformed)
    entry.isComponent = isComponent
    importersChanged = wasComponent !== isComponent

    // Store old imports on entry for later comparison
    ;(entry as any)._oldImports = oldImports
  }

  // Track modules whose importers changed (need to send updates for them)
  let modulesWithChangedImporters = new Set<string>()

  // Process imports from the loader (statically parsed from code)
  // For each import, add this module as an importer to that import
  for (let importUrl of importsFromLoader) {
    let normalizedImport = importUrl.split('?')[0].split('#')[0]

    // Skip self-imports
    if (normalizedImport === normalizedUrl) {
      continue
    }

    // Track that this module imports the normalized import
    entry.imports.add(normalizedImport)

    // Ensure the imported module has an entry (create placeholder if needed)
    if (!moduleRegistry.has(normalizedImport)) {
      // We don't know the file path yet, but we'll set it when that module loads
      moduleRegistry.set(normalizedImport, {
        url: normalizedImport,
        filePath: '', // Will be set when module actually loads
        isComponent: false,
        importers: new Set(),
        imports: new Set(),
      })
    }

    // Add bidirectional relationship: this module imports normalizedImport
    let importedEntry = moduleRegistry.get(normalizedImport)!
    let wasImporter = importedEntry.importers.has(normalizedUrl)
    importedEntry.importers.add(normalizedUrl)

    if (!wasImporter) {
      importersChanged = true
      // Track that this imported module's importers changed
      modulesWithChangedImporters.add(normalizedImport)
    }
  }

  // If HMR setup is complete and (this is a new module OR importer relationships changed),
  // send update to supervisor immediately so it can watch the new file.
  // This keeps the module graph up-to-date as imports appear/change during HMR.
  if (hmrSetupComplete && (isNewModule || importersChanged) && process.send) {
    process.send({
      type: 'module-update',
      url: normalizedUrl,
      filePath,
      isComponent,
      importers: Array.from(entry.importers),
    })
  }

  // Set as current importer for next imports (use normalized URL)
  // Only set for new modules - re-registrations shouldn't change currentImporter
  let prevImporter = currentImporter
  if (isNewModule) {
    currentImporter = normalizedUrl
  }

  // Reset currentImporter after module loads
  queueMicrotask(() => {
    if (isNewModule) {
      currentImporter = prevImporter
    }

    // After module finishes loading, send updates for modules whose importers changed
    if (hmrSetupComplete && process.send) {
      // Send updates for removed imports
      if (!isNewModule) {
        let oldImports = (entry as any)._oldImports as Set<string> | undefined

        if (oldImports) {
          for (let oldImport of oldImports) {
            if (!entry.imports.has(oldImport)) {
              // This import was removed - notify supervisor with updated importers
              let importedEntry = moduleRegistry.get(oldImport)
              if (importedEntry) {
                process.send({
                  type: 'module-update',
                  url: oldImport,
                  filePath: importedEntry.filePath,
                  isComponent: importedEntry.isComponent,
                  importers: Array.from(importedEntry.importers),
                })
              }
            }
          }
          // Clean up temporary storage
          delete (entry as any)._oldImports
        }
      }

      // Send updates for modules that gained new importers
      for (let moduleUrl of modulesWithChangedImporters) {
        let moduleEntry = moduleRegistry.get(moduleUrl)
        if (moduleEntry && moduleEntry.filePath) {
          process.send({
            type: 'module-update',
            url: moduleUrl,
            filePath: moduleEntry.filePath,
            isComponent: moduleEntry.isComponent,
            importers: Array.from(moduleEntry.importers),
          })
        }
      }
    }
  })
}

// Server-side HMR update handler
async function performUpdate(url: string, timestamp: number) {
  console.log(`[remix-watch] 🔥 ${url}`)

  // Import __hmr_update from component-hmr
  let { __hmr_update } = await import('@remix-run/component-hmr/runtime')

  try {
    // Dynamic import with cache-busting query string
    await __hmr_update(url, () => import(`${url}?t=${timestamp}`))
    console.log(`[remix-watch] ✅ Hot update applied`)
  } catch (error) {
    console.error(`[remix-watch] ❌ Hot update failed:`, error)
    throw error
  }
}

// Setup IPC listener for watcher messages
// This is automatically injected into server.ts/js by the loader
export async function setupHMR() {
  if (process.send) {
    // Wait a tick for all modules to register
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Send initial module registry to supervisor
    for (let [url, entry] of moduleRegistry.entries()) {
      process.send({
        type: 'module-update',
        url,
        filePath: entry.filePath,
        isComponent: entry.isComponent,
        importers: Array.from(entry.importers),
      })
    }

    // Mark setup as complete - future registerModule calls will send updates immediately
    hmrSetupComplete = true

    // Listen for HMR update messages from supervisor
    process.on('message', async (msg: any) => {
      if (msg.type === 'hmr') {
        await performUpdate(msg.file, msg.timestamp)
      }
    })

    console.log('[remix-watch] HMR ready\n')
  }
}
