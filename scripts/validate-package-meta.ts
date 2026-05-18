import * as fs from 'node:fs'
import { colors, colorize } from './utils/color.ts'
import { getAllPackageDirNames, getPackageFile } from './utils/packages.ts'

const CONSUMER_DEPENDENCY_FIELDS = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
] as const

type ConsumerDependencyField = (typeof CONSUMER_DEPENDENCY_FIELDS)[number]
type PackageDependencyMap = Record<string, string>

interface PublishedPackageInfo {
  dir: string
  packageJson: PublishedPackageJson
}

interface PublishedPackageJson {
  name: string
  dependencies?: PackageDependencyMap
  optionalDependencies?: PackageDependencyMap
  peerDependencies?: PackageDependencyMap
}

interface DependencyUsage {
  packageDir: string
  packageName: string
  field: ConsumerDependencyField
  dependencyName: string
  specifier: string
}

type RawPackageJson = {
  name?: unknown
  private?: unknown
} & {
  [field in ConsumerDependencyField]?: unknown
}

interface PackageMetaCheck {
  name: string
  validate(): string[]
}

function main() {
  let packageInfos = getPublishedPackageInfos()
  let checks: PackageMetaCheck[] = [
    {
      name: 'Published package.json files use explicit consumer-facing dependency ranges',
      validate() {
        return validateExplicitConsumerDependencyRanges(packageInfos)
      },
    },
    {
      name: 'Published package.json files use consistent consumer-facing dependency ranges across packages',
      validate() {
        return validateConsistentConsumerDependencyRanges(packageInfos)
      },
    },
  ]

  console.log('Validating package metadata...\n')

  let hasFailures = false

  for (let check of checks) {
    let issues = check.validate()

    if (issues.length > 0) {
      hasFailures = true
      console.error(`  ${colorize('✗', colors.red)} ${check.name}\n`)
      console.error(issues.join('\n\n'))
      continue
    }

    console.log(`  ${colorize('✓', colors.lightGreen)} ${check.name}`)
  }

  console.log()

  if (hasFailures) {
    process.exit(1)
  }
}

function getPublishedPackageInfos(): PublishedPackageInfo[] {
  let packageInfos: PublishedPackageInfo[] = []

  for (let dirName of getAllPackageDirNames().sort()) {
    let packageJsonPath = getPackageFile(dirName, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      continue
    }

    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as RawPackageJson
    if (typeof packageJson.name !== 'string' || packageJson.private === true) {
      continue
    }

    packageInfos.push({
      dir: `packages/${dirName}`,
      packageJson: {
        name: packageJson.name,
        ...readConsumerDependencies(packageJson, packageJsonPath),
      },
    })
  }

  return packageInfos
}

function validateExplicitConsumerDependencyRanges(packageInfos: PublishedPackageInfo[]): string[] {
  let violations: string[] = []

  for (let packageInfo of packageInfos) {
    for (let field of CONSUMER_DEPENDENCY_FIELDS) {
      let dependencies = packageInfo.packageJson[field]
      if (!dependencies) {
        continue
      }

      for (let [dependencyName, specifier] of Object.entries(dependencies)) {
        if (specifier.startsWith('catalog:')) {
          violations.push(
            `${packageInfo.dir}/package.json ${field}.${dependencyName} uses ${specifier}, but published consumer-facing dependencies must use explicit ranges.`,
          )
        }
      }
    }
  }

  return violations
}

function validateConsistentConsumerDependencyRanges(packageInfos: PublishedPackageInfo[]): string[] {
  let violations: string[] = []
  let firstPartyPackageNames = new Set(
    packageInfos.map((packageInfo) => packageInfo.packageJson.name),
  )
  let thirdPartyUsagesByName = new Map<string, DependencyUsage[]>()

  for (let packageInfo of packageInfos) {
    for (let field of CONSUMER_DEPENDENCY_FIELDS) {
      let dependencies = packageInfo.packageJson[field]
      if (!dependencies) {
        continue
      }

      for (let [dependencyName, specifier] of Object.entries(dependencies)) {
        if (firstPartyPackageNames.has(dependencyName)) {
          continue
        }

        let usages = thirdPartyUsagesByName.get(dependencyName) ?? []
        usages.push({
          packageDir: packageInfo.dir,
          packageName: packageInfo.packageJson.name,
          field,
          dependencyName,
          specifier,
        })
        thirdPartyUsagesByName.set(dependencyName, usages)
      }
    }
  }

  for (let [dependencyName, usages] of thirdPartyUsagesByName) {
    let packageNames = new Set(usages.map((usage) => usage.packageName))
    if (packageNames.size < 2) {
      continue
    }

    let specifiers = new Set(usages.map((usage) => usage.specifier))
    if (specifiers.size > 1) {
      violations.push(
        [
          `${dependencyName} has inconsistent ranges across published consumer-facing dependencies:`,
          ...formatUsages(usages),
        ].join('\n'),
      )
    }
  }

  return violations
}

function readConsumerDependencies(
  packageJson: RawPackageJson,
  packageJsonPath: string,
): Omit<PublishedPackageJson, 'name'> {
  let dependencies: Omit<PublishedPackageJson, 'name'> = {}

  for (let field of CONSUMER_DEPENDENCY_FIELDS) {
    let value = packageJson[field]
    if (value === undefined) {
      continue
    }

    if (!isDependencyMap(value)) {
      throw new Error(`Expected ${packageJsonPath} ${field} to be an object of string specifiers`)
    }

    dependencies[field] = value
  }

  return dependencies
}

function isDependencyMap(value: unknown): value is PackageDependencyMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every((specifier) => typeof specifier === 'string')
}

function formatUsages(usages: DependencyUsage[]): string[] {
  return usages.map(
    (usage) =>
      `- ${usage.packageDir}/package.json ${usage.field}.${usage.dependencyName}: ${usage.specifier}`,
  )
}

main()
