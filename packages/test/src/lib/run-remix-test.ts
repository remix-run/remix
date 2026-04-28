import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { isMainThread } from 'node:worker_threads'
import { generateCombinedCoverageReport } from './coverage.ts'
import { getRemixTestHelpText, loadConfig, type ResolvedRemixTestConfig } from './config.ts'
import { importModule } from './import-module.ts'
import { loadPlaywrightConfig, resolveProjects } from './playwright.ts'
import { createReporter } from './reporters/index.ts'
import { runServerTests } from './runner.ts'
import { IS_BUN, type Counts } from './utils.ts'
import { createWatcher } from './watcher.ts'

export interface RunRemixTestOptions {
  argv?: string[]
  cwd?: string
}

interface DiscoveredTests {
  files: string[]
  serverFiles: string[]
  e2eFiles: string[]
}

export async function runRemixTest(options: RunRemixTestOptions = {}): Promise<number> {
  let argv = options.argv ?? process.argv.slice(2)
  let cwd = await resolveCwd(options.cwd ?? process.cwd())
  let previousCwd = process.cwd()

  if (!isMainThread) {
    return await runRemixTestInCwd(argv, cwd)
  }

  try {
    process.chdir(cwd)
    return await runRemixTestInCwd(argv, cwd)
  } finally {
    process.chdir(previousCwd)
  }
}

async function runRemixTestInCwd(argv: string[], cwd: string): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(getRemixTestHelpText())
    return 0
  }

  let config = await loadConfig(argv, cwd)
  let hasExited = false
  let latestExitCode = 0
  let watcher: ReturnType<typeof createWatcher> | undefined
  let running = false
  let queued = false
  let rerunTimer: NodeJS.Timeout | undefined
  let resolveRun: ((exitCode: number) => void) | undefined

  let runPromise = new Promise<number>((resolve) => {
    resolveRun = resolve
  })

  let cleanupAndExit = (code: number) => {
    if (hasExited) return
    hasExited = true
    watcher?.close()
    clearTimeout(rerunTimer)
    process.off('SIGINT', handleInterrupt)
    process.off('SIGTERM', handleInterrupt)
    resolveRun?.(code)
  }

  let handleInterrupt = () => cleanupAndExit(latestExitCode)

  let queueRerun = (reason: string) => {
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

  let executeRun = async () => {
    if (hasExited) return

    running = true

    let globalTeardown: (() => Promise<void> | void) | undefined

    try {
      if (config.setup) {
        let mod = await importModule(path.resolve(cwd, config.setup), import.meta)
        let globalSetup: (() => Promise<void> | void) | undefined = mod.globalSetup
        globalTeardown = mod.globalTeardown
        await globalSetup?.()
      }

      let discoveredTests = await discoverTests(config, cwd)
      if (discoveredTests == null) {
        latestExitCode = 1
        cleanupAndExit(latestExitCode)
        return
      }

      let { files, serverFiles, e2eFiles } = discoveredTests

      if (config.watch) {
        watcher ??= createWatcher((file) => queueRerun(file))
        watcher.update(files)
      }

      let playwrightConfig =
        config.playwrightConfig == null || typeof config.playwrightConfig === 'string'
          ? await loadPlaywrightConfig(config.playwrightConfig, cwd)
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

      if (serverFiles.length > 0) {
        reporter.onSectionStart('\nRunning server tests:')
        let serverResult = await runServerTests(
          serverFiles,
          reporter,
          config.concurrency,
          'server',
          {
            coverage: config.coverage,
            cwd,
          },
        )
        counts.failed += serverResult.failed
        counts.passed += serverResult.passed
        counts.skipped += serverResult.skipped
        counts.todo += serverResult.todo
        allCoverageMaps.push(serverResult.coverageMap)
      }

      if (e2eFiles.length > 0) {
        let projects = resolveProjects(playwrightConfig)
        if (config.project) {
          let projectNames = config.project.split(',').map((project) => project.trim())
          projects = projects.filter(
            (project) => project.name && projectNames.includes(project.name),
          )
          if (projects.length === 0) {
            throw new Error(`No playwright projects found with name(s) "${config.project}"`)
          }
        }

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

          let e2eResult =
            e2eFiles.length > 0
              ? await runServerTests(e2eFiles, reporter, config.concurrency, 'e2e', {
                  open: config.browser?.open,
                  playwrightUseOpts: project.playwrightUseOpts,
                  projectName: project.name,
                  coverage: config.coverage,
                  cwd,
                })
              : null

          counts.passed += e2eResult?.passed ?? 0
          counts.failed += e2eResult?.failed ?? 0
          counts.skipped += e2eResult?.skipped ?? 0
          counts.todo += e2eResult?.todo ?? 0
          allCoverageMaps.push(e2eResult?.coverageMap)
        }
      }

      reporter.onSummary(counts, performance.now() - startTime)

      let thresholdsPassed = true
      if (config.coverage) {
        thresholdsPassed = await generateCombinedCoverageReport(
          allCoverageMaps,
          cwd,
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

  process.on('SIGINT', handleInterrupt)
  process.on('SIGTERM', handleInterrupt)

  try {
    await executeRun()

    if (config.watch && !hasExited) {
      console.log('Watching for changes. Press Ctrl+C to stop.')
    }
  } catch {
    cleanupAndExit(1)
  }

  return await runPromise
}

async function resolveCwd(cwd: string): Promise<string> {
  try {
    return await fsp.realpath(cwd)
  } catch {
    return path.resolve(cwd)
  }
}

async function discoverTests(
  config: ResolvedRemixTestConfig,
  cwd: string,
): Promise<DiscoveredTests | null> {
  let files = await findFiles(config.glob.test, config.glob.exclude, cwd)

  if (files.length === 0) {
    console.log(`No test files found matching pattern: ${config.glob.test}`)
    return null
  }

  let e2eSet = new Set(await findFiles(config.glob.e2e, config.glob.exclude, cwd))

  let types = new Set(config.type.split(','))
  let e2eFiles = types.has('e2e') ? files.filter((file) => e2eSet.has(file)) : []
  let serverFiles = types.has('server') ? files.filter((file) => !e2eSet.has(file)) : []

  let totalFiles = serverFiles.length + e2eFiles.length

  if (totalFiles === 0) {
    console.log(`No test files remain after filtering for type ${config.type}`)
    return null
  }

  console.log(
    `Found ${totalFiles} test file(s) (${serverFiles.length} server, ${e2eFiles.length} e2e)`,
  )

  return {
    files,
    serverFiles,
    e2eFiles,
  }
}

async function findFiles(pattern: string, excludePattern: string, cwd: string): Promise<string[]> {
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
