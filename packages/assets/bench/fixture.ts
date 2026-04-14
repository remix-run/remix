import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { AssetServerOptions } from '@remix-run/assets'

interface BenchFixtureStat {
  label: string
  value: number | string
}

export interface BenchFixture {
  id: 'basic' | 'deep-graph'
  label: string
  entryPoint: string
  assetServer: Pick<AssetServerOptions, 'allow' | 'routes'>
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
    entryPointFile: 'app/entry.tsx',
    entryPointUrl: '/assets/app/entry.tsx',
    expectedEntryUrlSubstrings: [
      '/assets/app/summary.@',
      '/assets/bench-packages/shared/strings.@',
      '/assets/bench-packages/ui/panel.@',
      '/assets/packages/component/',
    ],
    expectedPreloadUrlSubstrings: [
      '/assets/bench-packages/shared/strings.@',
      '/assets/bench-packages/ui/panel.@',
      '/assets/packages/component/',
    ],
    createStats: async () => [
      { label: 'app', value: await countSourceModules(projectRoot) },
      { label: 'benchPackages', value: await countSourceModules(packagesRoot) },
      { label: 'directImports', value: 4 },
      { label: 'importModes', value: 'relative,#imports,tsconfig,bare' },
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
    entryPointFile: 'app/entry.tsx',
    entryPointUrl: '/assets/app/entry.tsx',
    expectedEntryUrlSubstrings: [],
    expectedPreloadUrlSubstrings: ['/assets/bench-packages/ui/', '/assets/packages/component/'],
    createStats: async () => [
      { label: 'app', value: await countSourceModules(projectRoot) },
      { label: 'benchPackages', value: await countSourceModules(packagesRoot) },
      { label: 'featureSlices', value: 18 },
      { label: 'workspacePackages', value: 'component' },
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
  let repoPackagesRoot = path.join(repoRoot, 'packages')
  let entryPoint = path.join(options.projectRoot, options.entryPointFile)

  return {
    id: options.id,
    label: options.label,
    entryPoint,
    assetServer: {
      allow: [options.projectRoot, options.packagesRoot, repoPackagesRoot],
      routes: [
        createRoute(repoRoot, path.join(options.projectRoot, 'app'), '/assets/app/*path'),
        createRoute(repoRoot, options.packagesRoot, '/assets/bench-packages/*path'),
        createRoute(repoRoot, repoPackagesRoot, '/assets/packages/*path'),
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

async function countSourceModules(directory: string): Promise<number> {
  let total = 0
  for (let entry of await fs.readdir(directory, { withFileTypes: true })) {
    let fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      total += await countSourceModules(fullPath)
      continue
    }
    if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      total++
    }
  }
  return total
}
