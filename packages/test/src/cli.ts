#!/usr/bin/env node
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { runServerTests } from './lib/runner.ts'
import { createReporter } from './lib/reporters/index.ts'
import { createWatcher } from './lib/watcher.ts'
import { importModule } from './lib/import-module.ts'
import { loadPlaywrightConfig, resolveProjects } from './lib/playwright.ts'
import { loadConfig, type ResolvedRemixTestConfig } from './lib/config.ts'
import type { Counts } from './lib/utils.ts'

const config = await loadConfig()

let hasExited = false
let latestExitCode = 0
let watcher: ReturnType<typeof createWatcher> | undefined
let running = false
let queued = false
let rerunTimer: NodeJS.Timeout | undefined

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

    let { files, serverFiles, e2eFiles } = await discoverTests(config)

    if (config.watch) {
      watcher ??= createWatcher((file) => queueRerun(file))
      watcher.update(files)
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

    // Run server tests
    if (serverFiles.length > 0) {
      reporter.onSectionStart('\nRunning server tests:')
      let serverResult = await runServerTests(serverFiles, reporter, config.concurrency, 'server')
      counts.failed += serverResult.failed
      counts.passed += serverResult.passed
      counts.skipped += serverResult.skipped
      counts.todo += serverResult.todo
    }

    // Run e2e tests for all browsers configured by the user
    if (e2eFiles.length > 0) {
      let projects = resolveProjects(playwrightConfig)
      if (config.project) {
        let projectNames = config.project.split(',').map((p) => p.trim())
        projects = projects.filter((p) => p.name && projectNames.includes(p.name))
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
              })
            : null

        counts.passed += e2eResult?.passed ?? 0
        counts.failed += e2eResult?.failed ?? 0
        counts.skipped += e2eResult?.skipped ?? 0
        counts.todo += e2eResult?.todo ?? 0
      }
    }

    reporter.onSummary(counts, performance.now() - startTime)

    latestExitCode = counts.failed > 0 ? 1 : 0
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
  e2eFiles: string[]
}> {
  async function findFiles(pattern: string) {
    let files: string[] = []
    let exclude = ['node_modules/**', '.git/**']

    for await (let file of fsp.glob(pattern, { cwd: process.cwd(), exclude })) {
      files.push(path.resolve(process.cwd(), file))
    }

    return files
  }

  let files = await findFiles(config.glob.test)

  if (files.length === 0) {
    console.log(`No test files found matching pattern: ${config.glob.test}`)
    process.exit(1)
  }

  let e2eSet = new Set(await findFiles(config.glob.e2e))

  let types = new Set(config.type.split(','))
  let e2eFiles = types.has('e2e') ? files.filter((f) => e2eSet.has(f)) : []
  let serverFiles = types.has('server') ? files.filter((f) => !e2eSet.has(f)) : []

  let totalFiles = serverFiles.length + e2eFiles.length

  if (totalFiles === 0) {
    console.log(`No test files remain after filtering for type ${config.type}`)
    process.exit(1)
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
  process.exit(code)
}
