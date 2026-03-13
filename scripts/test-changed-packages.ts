import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

type PackageInfo = {
  dirName: string
  name: string
  dependencies: string[]
}

type CliOptions = {
  baseRef: string
  headRef: string
  listOnly: boolean
}

function main() {
  let options = parseArgs(process.argv.slice(2))
  let packageInfos = getPackageInfos()
  let changedPackages = getChangedPackageNames(options.baseRef, options.headRef, packageInfos)
  let selectedPackages = getSelectedPackageNames(changedPackages, packageInfos)

  if (options.listOnly) {
    console.log(JSON.stringify(selectedPackages, null, 2))
    return
  }

  if (selectedPackages.length === 0) {
    console.log(
      `No package changes detected between ${options.baseRef} and ${options.headRef}. Skipping package tests.`,
    )
    return
  }

  console.log(
    `Running tests for packages changed between ${options.baseRef} and ${options.headRef}:`,
  )
  for (let packageName of selectedPackages) {
    console.log(`- ${packageName}`)
  }
  console.log()

  let args = selectedPackages.flatMap((packageName) => ['--filter', packageName])
  args.push('run', 'test')

  let result = cp.spawnSync('pnpm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function parseArgs(args: string[]): CliOptions {
  let baseRef = ''
  let headRef = 'HEAD'
  let listOnly = false

  for (let arg of args) {
    if (arg === '--list') {
      listOnly = true
      continue
    }

    if (baseRef === '') {
      baseRef = arg
      continue
    }

    if (headRef === 'HEAD') {
      headRef = arg
      continue
    }

    throw new Error(`Unexpected argument: ${arg}`)
  }

  if (baseRef === '') {
    throw new Error('Usage: node ./scripts/test-changed-packages.ts <base-ref> [head-ref] [--list]')
  }

  return { baseRef, headRef, listOnly }
}

function getPackageInfos(): PackageInfo[] {
  let packagesDir = path.join(process.cwd(), 'packages')
  let infos: PackageInfo[] = []

  for (let dirName of fs.readdirSync(packagesDir)) {
    let packageJsonPath = path.join(packagesDir, dirName, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      continue
    }

    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      name?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }

    if (typeof packageJson.name !== 'string') {
      continue
    }

    let dependencyNames = new Set<string>()

    for (let field of [
      packageJson.dependencies,
      packageJson.devDependencies,
      packageJson.optionalDependencies,
      packageJson.peerDependencies,
    ]) {
      for (let dependencyName of Object.keys(field ?? {})) {
        dependencyNames.add(dependencyName)
      }
    }

    infos.push({
      dirName,
      name: packageJson.name,
      dependencies: [...dependencyNames],
    })
  }

  return infos
}

function getChangedPackageNames(
  baseRef: string,
  headRef: string,
  packageInfos: PackageInfo[],
): Set<string> {
  let diffOutput = cp.execFileSync(
    'git',
    ['diff', '--name-only', `${baseRef}...${headRef}`, '--', 'packages/*'],
    { encoding: 'utf8' },
  )

  let dirNameToPackageName = new Map(packageInfos.map((info) => [info.dirName, info.name]))
  let changedPackages = new Set<string>()

  for (let file of diffOutput.split('\n')) {
    if (!file.startsWith('packages/')) {
      continue
    }

    let [, dirName] = file.split('/', 3)
    let packageName = dirNameToPackageName.get(dirName)
    if (packageName != null) {
      changedPackages.add(packageName)
    }
  }

  return changedPackages
}

function getSelectedPackageNames(
  changedPackages: Set<string>,
  packageInfos: PackageInfo[],
): string[] {
  if (changedPackages.size === 0) {
    return []
  }

  let knownPackageNames = new Set(packageInfos.map((info) => info.name))
  let reverseDependencies = new Map<string, Set<string>>()

  for (let info of packageInfos) {
    reverseDependencies.set(info.name, new Set())
  }

  for (let info of packageInfos) {
    for (let dependencyName of info.dependencies) {
      if (!knownPackageNames.has(dependencyName)) {
        continue
      }

      reverseDependencies.get(dependencyName)?.add(info.name)
    }
  }

  let selectedPackages = new Set(changedPackages)
  let queue = [...changedPackages]

  while (queue.length > 0) {
    let packageName = queue.shift()
    if (packageName == null) {
      continue
    }

    for (let dependentName of reverseDependencies.get(packageName) ?? []) {
      if (selectedPackages.has(dependentName)) {
        continue
      }

      selectedPackages.add(dependentName)
      queue.push(dependentName)
    }
  }

  return packageInfos
    .map((info) => info.name)
    .filter((packageName) => selectedPackages.has(packageName))
}

main()
