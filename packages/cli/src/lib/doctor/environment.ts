import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'
import { createRequire } from 'node:module'

import { createDoctorSuite, type DoctorFinding, type DoctorSuiteResult } from './types.ts'

interface DoctorPackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  engines?: Record<string, string>
  name?: string
}

export interface EnvironmentDoctorResult {
  projectRoot?: string
  suite: DoctorSuiteResult
}

export async function checkEnvironment(
  cwd: string = process.cwd(),
): Promise<EnvironmentDoctorResult> {
  let projectRoot = await findNearestPackageRoot(cwd)
  if (projectRoot == null) {
    return {
      suite: createDoctorSuite('environment', [
        {
          code: 'project-root-not-found',
          message: 'Could not find package.json. Run this command inside a Remix project.',
          severity: 'warn',
          suite: 'environment',
        },
      ]),
    }
  }

  let packageJsonPath = path.join(projectRoot, 'package.json')
  let packageJson = await readPackageJson(packageJsonPath)
  if ('suite' in packageJson) {
    return {
      projectRoot,
      suite: packageJson.suite,
    }
  }

  let findings: DoctorFinding[] = []
  let nodeRequirement = packageJson.engines?.node

  if (nodeRequirement == null) {
    findings.push({
      actualPath: 'package.json',
      code: 'node-engine-missing',
      message:
        'package.json does not declare engines.node. Add one to document the supported Node.js version.',
      severity: 'advice',
      suite: 'environment',
    })
  } else {
    let nodeSupport = satisfiesNodeRange(process.version, nodeRequirement)

    if (nodeSupport == null) {
      findings.push({
        actualPath: 'package.json',
        code: 'node-engine-unparseable',
        message: `Could not evaluate engines.node "${nodeRequirement}" automatically.`,
        severity: 'advice',
        suite: 'environment',
      })
    } else if (!nodeSupport) {
      findings.push({
        actualPath: 'package.json',
        code: 'node-version-unsupported',
        message: `Project requires Node.js ${nodeRequirement}, but the current runtime is ${process.version}.`,
        severity: 'warn',
        suite: 'environment',
      })
    }
  }

  if (!hasRemixDependency(packageJson)) {
    findings.push({
      actualPath: 'package.json',
      code: 'remix-dependency-missing',
      message: 'package.json does not declare a remix dependency.',
      severity: 'warn',
      suite: 'environment',
    })
  }

  if (!canResolveRemix(projectRoot)) {
    findings.push({
      actualPath: 'package.json',
      code: 'remix-install-missing',
      message: 'Could not resolve remix from this project. Install dependencies and try again.',
      severity: 'warn',
      suite: 'environment',
    })
  }

  return {
    projectRoot,
    suite: createDoctorSuite('environment', findings),
  }
}

async function findNearestPackageRoot(startDir: string): Promise<string | null> {
  let currentDir = path.resolve(startDir)

  while (true) {
    if (await pathExists(path.join(currentDir, 'package.json'))) {
      return currentDir
    }

    let parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      return null
    }

    currentDir = parentDir
  }
}

async function readPackageJson(
  packageJsonPath: string,
): Promise<DoctorPackageJson | { suite: DoctorSuiteResult }> {
  let source: string

  try {
    source = await fs.readFile(packageJsonPath, 'utf8')
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    let detail =
      nodeError.code == null
        ? 'Could not read package.json.'
        : `Could not read package.json (${nodeError.code}).`

    return {
      suite: createDoctorSuite('environment', [
        {
          actualPath: 'package.json',
          code: 'package-json-read-failed',
          message: detail,
          severity: 'warn',
          suite: 'environment',
        },
      ]),
    }
  }

  try {
    return JSON.parse(source) as DoctorPackageJson
  } catch {
    return {
      suite: createDoctorSuite('environment', [
        {
          actualPath: 'package.json',
          code: 'package-json-invalid',
          message: 'package.json is not valid JSON.',
          severity: 'warn',
          suite: 'environment',
        },
      ]),
    }
  }
}

function hasRemixDependency(packageJson: DoctorPackageJson): boolean {
  return packageJson.dependencies?.remix != null || packageJson.devDependencies?.remix != null
}

function canResolveRemix(projectRoot: string): boolean {
  try {
    let require = createRequire(path.join(projectRoot, 'package.json'))
    require.resolve('remix/package.json')
    return true
  } catch {
    return false
  }
}

function satisfiesNodeRange(version: string, range: string): boolean | null {
  let parsedVersion = parseSemver(version)
  if (parsedVersion == null) {
    return null
  }

  let groups = range
    .split('||')
    .map((group) => group.trim())
    .filter(Boolean)

  if (groups.length === 0) {
    return null
  }

  let foundSupportedGroup = false

  for (let group of groups) {
    let comparators = group.split(/\s+/).filter(Boolean)
    if (comparators.length === 0) {
      return null
    }

    let isMatch = true

    for (let comparator of comparators) {
      let parsedComparator = parseComparator(comparator)
      if (parsedComparator == null) {
        return null
      }

      if (
        !compareWithComparator(parsedVersion, parsedComparator.operator, parsedComparator.version)
      ) {
        isMatch = false
        break
      }
    }

    if (isMatch) {
      foundSupportedGroup = true
      break
    }
  }

  return foundSupportedGroup
}

function parseComparator(
  value: string,
): { operator: '<' | '<=' | '=' | '>' | '>='; version: Semver } | null {
  let match = /^(<=|>=|<|>|=)?(v?\d+(?:\.\d+){0,2})$/.exec(value)
  if (match == null) {
    return null
  }

  let version = parseSemver(match[2])
  if (version == null) {
    return null
  }

  return {
    operator: (match[1] as '<' | '<=' | '=' | '>' | '>=' | undefined) ?? '=',
    version,
  }
}

interface Semver {
  major: number
  minor: number
  patch: number
}

function parseSemver(value: string): Semver | null {
  let match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(value.trim())
  if (match == null) {
    return null
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? '0'),
    patch: Number(match[3] ?? '0'),
  }
}

function compareWithComparator(
  left: Semver,
  operator: '<' | '<=' | '=' | '>' | '>=',
  right: Semver,
): boolean {
  let comparison = compareSemver(left, right)

  switch (operator) {
    case '<':
      return comparison < 0
    case '<=':
      return comparison <= 0
    case '=':
      return comparison === 0
    case '>':
      return comparison > 0
    case '>=':
      return comparison >= 0
  }
}

function compareSemver(left: Semver, right: Semver): number {
  if (left.major !== right.major) {
    return left.major - right.major
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor
  }

  return left.patch - right.patch
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return false
    }

    throw error
  }
}
