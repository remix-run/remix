import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

type PackageInfo = {
  dirName: string
  name: string
  dependencies: string[]
  scripts: string[]
}

type CliOptions = {
  baseRef: string
  headRef: string
  listOnly: boolean
  scriptName: string
}

function main() {
  let options = parseArgs(process.argv.slice(2))
  let packageInfos = getPackageInfos()
  let changedPackages = getChangedPackageNames(options.baseRef, options.headRef, packageInfos)
  let selectedPackages = getSelectedPackageNames(changedPackages, packageInfos, options.scriptName)

  if (options.listOnly) {
    console.log(JSON.stringify(selectedPackages, null, 2))
    return
  }

  if (selectedPackages.length === 0) {
    console.log(
      `No affected packages with a "${options.scriptName}" script between ${options.baseRef} and ${options.headRef}. Skipping.`,
    )
    return
  }

  console.log(
    `Running ${options.scriptName} for packages changed between ${options.baseRef} and ${options.headRef}:`,
  )
  for (let packageName of selectedPackages) {
    console.log(`- ${packageName}`)
  }
  console.log()

  let args = selectedPackages.flatMap((packageName) => ['--filter', packageName])
  args.push('run', options.scriptName)

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
  let scriptName = 'test'

  for (let index = 0; index < args.length; index++) {
    let arg = args[index]
    if (arg === '--list') {
      listOnly = true
      continue
    }

    if (arg === '--script') {
      let value = args[++index]
      if (!value || value.startsWith('--')) {
        throw new Error('Expected a script name after --script')
      }
      scriptName = value
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
    throw new Error(
      'Usage: node ./scripts/detect-changed-packages.ts <base-ref> [head-ref] [--list] [--script <script-name>]',
    )
  }

  return { baseRef, headRef, listOnly, scriptName }
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
      scripts?: Record<string, string>
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
      scripts: Object.keys(packageJson.scripts ?? {}),
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
  scriptName: string,
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
    .filter((info) => selectedPackages.has(info.name) && info.scripts.includes(scriptName))
    .map((info) => info.name)
}

main()
