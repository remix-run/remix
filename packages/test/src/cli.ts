#!/usr/bin/env node
import * as fsp from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import { runBrowserTests } from './lib/runner-browser.ts'
import { runServerTests } from './lib/runner.ts'
import { createReporter } from './lib/reporters/index.ts'
import { generateCombinedCoverageReport } from './lib/coverage.ts'
import { createWatcher } from './lib/watcher.ts'
import { importModule } from './lib/import-module.ts'
import { loadPlaywrightConfig, resolveProjects } from './lib/playwright.ts'
import { loadConfig, type ResolvedRemixTestConfig } from './lib/config.ts'
import { IS_BUN, type Counts } from './lib/utils.ts'

const config = await loadConfig()

let hasExited = false
let latestExitCode = 0
let watcher: ReturnType<typeof createWatcher> | undefined
let running = false
let queued = false
let rerunTimer: NodeJS.Timeout | undefined
let browserServer: http.Server | undefined
let browserPort: number | undefined

process.on('SIGINT', () => cleanupAndExit(latestExitCode))
process.on('SIGTERM', () => cleanupAndExit(latestExitCode))

try {
  await executeRun()

  if (config.watch) {
    console.log('Watching for changes. Press Ctrl+C to stop.')
  }
} catch {
  cleanupAndExit(1)
}

async function executeRun() {
  if (hasExited) return

  running = true

  let globalTeardown: (() => Promise<void> | void) | undefined

  try {
    if (config.setup) {
      let mod = await importModule(path.resolve(process.cwd(), config.setup), import.meta)
      let globalSetup: (() => Promise<void> | void) | undefined = mod.globalSetup
      globalTeardown = mod.globalTeardown
      await globalSetup?.()
    }

    let { files, serverFiles, browserFiles, e2eFiles } = await discoverTests(config)

    if (config.watch) {
      watcher ??= createWatcher((file) => queueRerun(file))
      watcher.update(files)
    }

    if (browserFiles.length > 0 && !browserServer) {
      let { startServer } = await importModule('./app/server.tsx', import.meta, {
        // TODO: Do we need this?
        tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
      })
      let result = await startServer(browserFiles)
      browserServer = result.server
      browserPort = result.port
    }

    let playwrightConfig =
      config.playwrightConfig == null || typeof config.playwrightConfig === 'string'
        ? await loadPlaywrightConfig(config.playwrightConfig)
        : config.playwrightConfig

    let reporter = createReporter(config.reporter)
    let startTime = performance.now()

    let counts: Counts = {
      passed: 0,
      failed: 0,
      skipped: 0,
      todo: 0,
    }
    let allCoverageMaps: Array<ReturnType<typeof Object.values>[number] | null | undefined> = []

    // Run server tests
    if (serverFiles.length > 0) {
      reporter.onSectionStart('\nRunning server tests:')
      let serverResult = await runServerTests(serverFiles, reporter, config.concurrency, 'server', {
        coverage: config.coverage,
      })
      counts.failed += serverResult.failed
      counts.passed += serverResult.passed
      counts.skipped += serverResult.skipped
      counts.todo += serverResult.todo
      allCoverageMaps.push(serverResult.coverageMap)
    }

    // Run browser/e2e tests for all browsers configured by the user
    if (browserFiles.length > 0 || e2eFiles.length > 0) {
      let projects = resolveProjects(playwrightConfig)
      if (config.project) {
        let projectNames = config.project.split(',').map((p) => p.trim())
        projects = projects.filter((p) => p.name && projectNames.includes(p.name))
        if (projects.length === 0) {
          throw new Error(`No playwright projects found with name(s) "${config.project}"`)
        }
      }

      let lastBrowserResult: Awaited<ReturnType<typeof runBrowserTests>> | null = null

      for (let project of projects) {
        reporter.onSectionStart(`\nRunning tests for project \`${project.name}\`:`)

        if (config.browser?.open) {
          if (project.playwrightUseOpts?.headless === true) {
            let label = project.name ? ` (project "${project.name}")` : ''
            console.warn(
              `Warning: browser.open is set but playwright headless is explicitly true${label} — ignoring browser.open`,
            )
          } else {
            project.playwrightUseOpts = { ...project.playwrightUseOpts, headless: false }
          }
        }

        let [browserResult, e2eResult] = await Promise.all([
          browserFiles.length > 0
            ? runBrowserTests({
                baseUrl: `http://localhost:${browserPort}`,
                console: config.browser?.echo,
                open: config.browser?.open,
                playwrightUseOpts: project.playwrightUseOpts,
                projectName: project.name,
                reporter,
              })
            : null,
          e2eFiles.length > 0
            ? runServerTests(e2eFiles, reporter, config.concurrency, 'e2e', {
                open: config.browser?.open,
                playwrightUseOpts: project.playwrightUseOpts,
                projectName: project.name,
                coverage: config.coverage,
              })
            : null,
        ])

        counts.passed += (browserResult?.results.passed ?? 0) + (e2eResult?.passed ?? 0)
        counts.failed += (browserResult?.results.failed ?? 0) + (e2eResult?.failed ?? 0)
        counts.skipped += (browserResult?.results.skipped ?? 0) + (e2eResult?.skipped ?? 0)
        counts.todo += (browserResult?.results.todo ?? 0) + (e2eResult?.todo ?? 0)
        allCoverageMaps.push(e2eResult?.coverageMap)

        if (browserResult) lastBrowserResult = browserResult
      }

      if (config.browser?.open && lastBrowserResult) {
        console.log('\nBrowser is open. Press Ctrl+C to close.')
        await Promise.race([
          lastBrowserResult.disconnected,
          new Promise<void>((resolve) => {
            process.once('SIGINT', resolve)
            process.once('SIGTERM', resolve)
          }),
        ])
        await lastBrowserResult.close()
      }
    }

    reporter.onSummary(counts, performance.now() - startTime)

    let thresholdsPassed = true
    if (config.coverage) {
      thresholdsPassed = await generateCombinedCoverageReport(
        allCoverageMaps,
        process.cwd(),
        config.coverage,
      )
    }
    latestExitCode = counts.failed > 0 || !thresholdsPassed ? 1 : 0
  } catch (error) {
    console.error('Error running tests:', error)
    latestExitCode = 1
  } finally {
    await globalTeardown?.()
    running = false
    if (queued) {
      queued = false
      queueRerun('queued change')
    } else if (!config.watch) {
      cleanupAndExit(latestExitCode)
    }
  }
}

async function discoverTests(config: ResolvedRemixTestConfig): Promise<{
  files: string[]
  serverFiles: string[]
  browserFiles: string[]
  e2eFiles: string[]
}> {
  let files = await findFiles(config.glob.test, config.glob.exclude)

  if (files.length === 0) {
    console.log(`No test files found matching pattern: ${config.glob.test}`)
    process.exit(1)
  }

  let browserSet = new Set(await findFiles(config.glob.browser, config.glob.exclude))
  let e2eSet = new Set(await findFiles(config.glob.e2e, config.glob.exclude))

  let types = new Set(config.type.split(','))
  let browserFiles = types.has('browser') ? files.filter((f) => browserSet.has(f)) : []
  let e2eFiles = types.has('e2e') ? files.filter((f) => e2eSet.has(f)) : []
  let serverFiles = types.has('server')
    ? files.filter((f) => !browserSet.has(f) && !e2eSet.has(f))
    : []

  let totalFiles = browserFiles.length + serverFiles.length + e2eFiles.length

  if (totalFiles === 0) {
    console.log(`No test files remain after filtering for type ${config.type}`)
    process.exit(1)
  }

  console.log(
    `Found ${totalFiles} test file(s) (${serverFiles.length} server, ${browserFiles.length} browser, ${e2eFiles.length} e2e)`,
  )

  return {
    files,
    serverFiles,
    browserFiles,
    e2eFiles,
  }
}

async function findFiles(pattern: string, excludePattern: string) {
  let cwd = process.cwd()
  let files: string[] = []

  if (IS_BUN) {
    // Bun's `fs.promises.glob` follows symlinks and doesn't prune traversal
    // via `exclude`, so it enters pnpm symlink cycles in `node_modules`.
    // Use Bun's native Glob, which defaults to `followSymlinks: false`.
    // @ts-expect-error — bun module is only resolvable under the Bun runtime
    let { Glob } = await import('bun')
    let glob = new Glob(pattern)
    let excludeGlob = new Glob(excludePattern)
    for await (let file of glob.scan({ cwd, absolute: true })) {
      if (!excludeGlob.match(path.relative(cwd, file))) {
        files.push(file)
      }
    }
    return files
  }

  for await (let file of fsp.glob(pattern, { cwd, exclude: [excludePattern] })) {
    files.push(path.resolve(cwd, file))
  }
  return files
}

function queueRerun(reason: string) {
  if (!config.watch || hasExited) return

  clearTimeout(rerunTimer)

  rerunTimer = setTimeout(() => {
    rerunTimer = undefined
    if (running) {
      queued = true
    } else {
      console.log(`\n↻ Change detected (${reason}), re-running tests...\n`)
      void executeRun()
    }
  }, 100)
}

function cleanupAndExit(code: number) {
  if (hasExited) return
  hasExited = true
  watcher?.close()
  browserServer?.close()
  process.exit(code)
}
