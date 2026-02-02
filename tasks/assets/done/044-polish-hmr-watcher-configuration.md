## Polish HMR watcher configuration

**Started:** 2026-02-02

Improve the file watcher configuration to be more explicit, performant, and maintainable. The current approach works but has accumulated complexity around pattern matching, directory traversal, and the relationship between middleware config and watcher behavior.

**Root cause identified:**

The core issue is an **impedance mismatch** between RegExp patterns (middleware config) and glob patterns (chokidar). This forces us to:

- Use a complex `ignored` function with heuristics instead of simple globs
- Guess whether paths are directories when chokidar doesn't provide stats
- Manually maintain the inversion between "allow these" and "ignore these"

**Architectural decision:**

**Switch from RegExp to glob patterns for `allow`/`deny` config.** This eliminates the impedance mismatch and allows patterns to be used directly by both the middleware (for serving) and chokidar (for watching).

Key insights from exploring Vite's approach:

1. Vite uses **globs for both serving filters and watch ignores**
2. They use **hard-coded default ignores** (not `.gitignore`, which can ignore files you want to watch like codegen output)
3. Watching and serving use the **same patterns** (single source of truth, no duplication)

**Solution:**

```typescript
// Change from RegExp to globs
export interface DevAssetsOptions {
  allow: string[] // Was: RegExp[] - e.g., ['app/**']
  deny?: string[] // Was: RegExp[] - e.g., ['**/.env*']

  workspace?: {
    root: string
    allow: string[]
    deny?: string[]
  }
}

// Minimal watcher ignores - allow patterns do most of the filtering
const WATCHER_IGNORED = [
  '**/.git/**', // Version control metadata
  '**/node_modules/**', // Dependencies (served but not watched)
]
```

**Why minimal watcher ignores:**

The `allow` patterns already define what to serve/watch. Watcher ignores are only needed for:

- `.git` - Never want to serve or watch (metadata)
- `node_modules` - Want to serve (dependencies) but not watch (not source code)

Everything else (build dirs, caches, etc.) is already excluded by not being in `allow` patterns. This is simpler and more correct than trying to enumerate every possible build artifact.

**Note:** Security-focused default deny patterns (e.g., `.env*`, private keys) are a separate concern and tracked in a different TODO.

**Benefits:**

1. **No heuristics** - Remove directory detection logic (lines 136-143 in `hmr-watcher.ts`)
2. **Single source of truth** - Same patterns for serving and watching
3. **Simpler watcher** - Can pass globs directly to chokidar or use picomatch
4. **Minimal ignores** - `allow` patterns do the filtering; ignores only for special cases
5. **Industry standard** - Globs are familiar, used by Vite/esbuild/Rollup
6. **Clear intent** - `'app/**'` is more self-documenting than `/^app\//`

**Migration:**

All current usage can be mechanically converted:

- `/^app\//` → `'app/**'`
- `/node_modules/` → `'**/node_modules/**'`
- `/\.env/` → `'**/.env*'`
- `/\.(pem|key|crt)$/` → `'**/*.{pem,key,crt}'`

**Note:** We're in a development branch, so this change can be made before the package is widely adopted.

**Workspace watching:**

**Decision: Do NOT watch workspace by default** - watching the entire workspace root causes EMFILE errors in large monorepos.

Instead:

- Only watch the app `root` directory
- Use an `ignored` function to prevent traversing into `node_modules` and `.git` directories
- This avoids EMFILE while still allowing workspace packages to be imported and served
- Legitimate symlinks in the app directory (e.g., to shared components) continue to work

```typescript
watch(root, {
  ignored: (testPath: string) => {
    let basename = path.basename(testPath)
    return basename === 'node_modules' || basename === '.git'
  },
})
```

**Why this approach:** Initially tried `followSymlinks: false`, but that breaks legitimate symlinks in the app directory. The `ignored` function approach prevents directory traversal into `node_modules` itself, solving the root cause rather than the symptom.

This balances functionality with performance. Workspace package HMR could be added later as an opt-in feature with explicit watch paths.

**Acceptance Criteria:**

- [x] Replace `RegExp[]` with `string[]` in types
- [x] Add `picomatch` dependency for glob matching
- [x] Implement pattern matching using picomatch for both serving and watching
- [x] Add minimal `WATCHER_IGNORED` list (only `.git` and `node_modules`)
- [x] Remove directory detection heuristic (lines 136-143 in `hmr-watcher.ts`)
- [x] Simplify the watcher's `ignored` option to use a function that blocks directory traversal
- [x] Filter watched file changes by `allow` patterns (let patterns do the work)
- [x] **Don't watch workspace by default** - Only watch app root, use `ignored` function to prevent `node_modules` traversal
- [x] Update all examples, docs, and tests to use globs
- [x] All unit tests pass
- [x] All existing E2E tests pass (15/15 tests passed)
- [x] **Manual testing**: Verify no EMFILE errors (ignored function prevents traversal)
- [x] **Manual testing**: Demo app works - HMR updates components without page reload
- [x] **Manual testing**: Codegen files are watched (we don't use gitignore, only minimal ignores)
- [x] Document workspace HMR limitations (documented in README)

**Note:** Security defaults (default deny patterns) will be handled in a separate TODO.

**Completed:** 2026-02-02

**Implementation summary:**

1. **Changed patterns from RegExp to glob strings** across all interfaces
2. **Added picomatch** for glob pattern matching (serving and watching)
3. **Simplified watcher** - removed 40+ lines of heuristics, uses minimal `ignored` function
4. **Added `ignored` function** to prevent `node_modules` traversal - critical for preventing EMFILE
5. **Updated all tests, examples, and docs** to use glob patterns
6. **Documented HMR limitations** in README

**Key learnings:**

- **Prevent traversal, not symlinks** - Using `ignored` function to block `node_modules` directory traversal is better than `followSymlinks: false` (which breaks legitimate app symlinks)
- **Chokidar traverses then filters** - The `ignored` option filters what gets watched, not what gets traversed, so you must ignore directories themselves, not just their contents
- **Minimal ignores work** - Only need to block `.git` and `node_modules` directories; allow patterns do the rest
- **Don't watch workspace by default** - Too risky in large monorepos; can be added later as opt-in
- **Globs eliminate complexity** - No need for directory detection heuristics
