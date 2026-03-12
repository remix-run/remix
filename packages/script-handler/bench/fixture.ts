import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface BenchFixture {
  root: string
  workspaceRoot: string
  entryPoint: string
  stats: {
    projectModules: number
    workspaceModules: number
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
  let entryPoint = 'app/entry.tsx'

  return {
    root: projectRoot,
    workspaceRoot: repoRoot,
    entryPoint,
    stats: {
      projectModules: await countSourceModules(projectRoot),
      workspaceModules: await countSourceModules(path.join(fixtureRoot, 'packages')),
    },
  }
}

async function countSourceModules(root: string): Promise<number> {
  let total = 0
  for (let entry of await fs.readdir(root, { withFileTypes: true })) {
    let fullPath = path.join(root, entry.name)
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
