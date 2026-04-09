import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { StyleServerOptions } from '../src/index.ts'

interface BenchFixtureStat {
  label: string
  value: number | string
}

export interface BenchFixture {
  id: 'basic' | 'deep-graph'
  label: string
  entryPoint: string
  styleServer: Pick<StyleServerOptions, 'allow' | 'routes'>
  entryPointUrl: string
  expectedEntryUrlSubstrings: string[]
  expectedPreloadUrlSubstrings: string[]
  stats: BenchFixtureStat[]
}

const benchFixturePromises = new Map<BenchFixture['id'], Promise<BenchFixture>>()

export function getBasicFixture(): Promise<BenchFixture> {
  return getFixture('basic')
}

export function getDeepGraphFixture(): Promise<BenchFixture> {
  return getFixture('deep-graph')
}

function getFixture(id: BenchFixture['id']): Promise<BenchFixture> {
  let fixture = benchFixturePromises.get(id)
  if (!fixture) {
    fixture = id === 'basic' ? readBasicFixture() : readDeepGraphFixture()
    benchFixturePromises.set(id, fixture)
  }

  return fixture
}

async function readBasicFixture(): Promise<BenchFixture> {
  let fixtureRoot = path.resolve(import.meta.dirname, 'fixtures/basic-fixture')
  let projectRoot = path.join(fixtureRoot, 'project')
  let packagesRoot = path.join(fixtureRoot, 'packages')

  return createBenchFixture({
    id: 'basic',
    label: 'basic',
    projectRoot,
    packagesRoot,
    entryPointFile: 'app/app.css',
    entryPointUrl: '/styles/app/app.css',
    expectedEntryUrlSubstrings: [
      '/styles/app/summary.css',
      '/styles/bench-packages/shared/tokens.css',
      '/styles/bench-packages/ui/panel.css',
    ],
    expectedPreloadUrlSubstrings: [
      '/styles/app/summary.css',
      '/styles/bench-packages/shared/tokens.css',
      '/styles/bench-packages/ui/panel.css',
    ],
    createStats: async () => [
      { label: 'app', value: await countStylesheets(projectRoot) },
      { label: 'benchPackages', value: await countStylesheets(packagesRoot) },
      { label: 'directImports', value: 4 },
      { label: 'importModes', value: 'relative,cross-package' },
    ],
  })
}

async function readDeepGraphFixture(): Promise<BenchFixture> {
  let fixtureRoot = path.resolve(import.meta.dirname, 'fixtures/large-fixture')
  let projectRoot = path.join(fixtureRoot, 'project')
  let packagesRoot = path.join(fixtureRoot, 'packages')

  return createBenchFixture({
    id: 'deep-graph',
    label: 'deep-graph',
    projectRoot,
    packagesRoot,
    entryPointFile: 'app/app.css',
    entryPointUrl: '/styles/app/app.css',
    expectedEntryUrlSubstrings: [],
    expectedPreloadUrlSubstrings: [
      '/styles/bench-packages/ui/',
      '/styles/bench-packages/shared/',
      '/styles/app/features/feature-00/card.css',
      '/styles/app/layout.css',
    ],
    createStats: async () => [
      { label: 'app', value: await countStylesheets(projectRoot) },
      { label: 'benchPackages', value: await countStylesheets(packagesRoot) },
      { label: 'featureSlices', value: 8 },
      { label: 'workspacePackages', value: 'shared,ui' },
    ],
  })
}

interface CreateBenchFixtureOptions {
  id: BenchFixture['id']
  label: string
  projectRoot: string
  packagesRoot: string
  entryPointFile: string
  entryPointUrl: string
  expectedEntryUrlSubstrings: string[]
  expectedPreloadUrlSubstrings: string[]
  createStats(): Promise<BenchFixtureStat[]>
}

async function createBenchFixture(options: CreateBenchFixtureOptions): Promise<BenchFixture> {
  let repoRoot = path.resolve(import.meta.dirname, '../../..')
  let entryPoint = path.join(options.projectRoot, options.entryPointFile)

  return {
    id: options.id,
    label: options.label,
    entryPoint,
    styleServer: {
      allow: [options.projectRoot, options.packagesRoot],
      routes: [
        createRoute(repoRoot, path.join(options.projectRoot, 'app'), '/styles/app/*path'),
        createRoute(repoRoot, options.packagesRoot, '/styles/bench-packages/*path'),
      ],
    },
    entryPointUrl: options.entryPointUrl,
    expectedEntryUrlSubstrings: options.expectedEntryUrlSubstrings,
    expectedPreloadUrlSubstrings: options.expectedPreloadUrlSubstrings,
    stats: await options.createStats(),
  }
}

function createRoute(root: string, directory: string, urlPattern: string) {
  let relativeDirectory = path.relative(root, directory).replace(/\\/g, '/')

  return {
    filePattern: `${relativeDirectory.replace(/\/+$/, '')}/*path`,
    urlPattern,
  }
}

async function countStylesheets(directory: string): Promise<number> {
  let total = 0
  for (let entry of await fs.readdir(directory, { withFileTypes: true })) {
    let fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      total += await countStylesheets(fullPath)
      continue
    }
    if (entry.name.endsWith('.css')) {
      total++
    }
  }
  return total
}
