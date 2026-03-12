import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface BenchFixture {
  roots: Array<{
    prefix?: string
    directory: string
    entryPoints?: readonly string[]
  }>
  entryPoint: string
  stats: {
    projectModules: number
    packageModules: number
  }
}

let benchFixturePromise: Promise<BenchFixture> | null = null

export function getLargeFixture(): Promise<BenchFixture> {
  benchFixturePromise ??= readLargeFixture()
  return benchFixturePromise
}

async function readLargeFixture(): Promise<BenchFixture> {
  let repoRoot = path.resolve(import.meta.dirname, '../../..')
  let fixtureRoot = path.resolve(import.meta.dirname, 'fixtures/large-fixture')
  let projectRoot = path.join(fixtureRoot, 'project')
  let packagesRoot = path.join(fixtureRoot, 'packages')
  let componentRoot = path.join(repoRoot, 'packages/component/src')
  let entryPoint = 'app/entry.tsx'

  return {
    roots: [
      { directory: projectRoot, entryPoints: [entryPoint] },
      { prefix: 'packages', directory: packagesRoot },
      { prefix: '@remix-run/component', directory: componentRoot },
    ],
    entryPoint,
    stats: {
      projectModules: await countSourceModules(projectRoot),
      packageModules: await countSourceModules(packagesRoot),
    },
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
