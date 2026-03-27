import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { CliError } from '../errors.ts'
import { loadRouteManifestFromAppRoot, type LoadedRouteManifest } from '../route-map.ts'
import { createDoctorSuite, type DoctorFinding, type DoctorSuiteResult } from './types.ts'

export interface ProjectContractDoctorResult {
  routesFile: string
  routeManifest?: LoadedRouteManifest
  suite: DoctorSuiteResult
}

export async function checkProjectContract(
  projectRoot: string,
): Promise<ProjectContractDoctorResult> {
  let routesFile = path.join(projectRoot, 'app', 'routes.ts')

  if (!(await pathExists(routesFile))) {
    return {
      routesFile,
      suite: createDoctorSuite('project-contract', [
        {
          code: 'routes-file-missing',
          expectedPath: 'app/routes.ts',
          message: 'Project is missing app/routes.ts.',
          severity: 'warn',
          suite: 'project-contract',
        },
      ]),
    }
  }

  try {
    let routeManifest = await loadRouteManifestFromAppRoot(projectRoot)

    return {
      routeManifest,
      routesFile,
      suite: createDoctorSuite('project-contract', []),
    }
  } catch (error) {
    let finding = toProjectContractFinding(error)

    return {
      routesFile,
      suite: createDoctorSuite('project-contract', [finding]),
    }
  }
}

function toProjectContractFinding(error: unknown): DoctorFinding {
  if (error instanceof CliError) {
    if (error.code === 'RMX_ROUTE_MAP_LOADER_INVALID_JSON') {
      return {
        code: 'route-map-invalid-json',
        message: 'Route-map loader returned invalid JSON while loading app/routes.ts.',
        severity: 'warn',
        suite: 'project-contract',
      }
    }

    if (error.code === 'RMX_ROUTE_MAP_LOADER_SIGNAL') {
      return {
        code: 'route-map-loader-signal',
        message: error.message,
        severity: 'warn',
        suite: 'project-contract',
      }
    }

    if (error.code === 'RMX_ROUTE_MAP_LOADER_FAILED') {
      return classifyRouteMapLoaderFailure(error.message)
    }
  }

  let message = error instanceof Error ? error.message : String(error)
  return {
    code: 'route-module-import-failed',
    message: `Failed to load app/routes.ts: ${message}`,
    severity: 'warn',
    suite: 'project-contract',
  }
}

function classifyRouteMapLoaderFailure(message: string): DoctorFinding {
  if (message.includes('must export a named "routes" value')) {
    return {
      code: 'routes-export-missing',
      message,
      severity: 'warn',
      suite: 'project-contract',
    }
  }

  if (
    message.startsWith('Invalid route map value at "') ||
    message.startsWith('Detected a route map cycle at "')
  ) {
    return {
      code: 'route-map-invalid',
      message,
      severity: 'warn',
      suite: 'project-contract',
    }
  }

  return {
    code: 'route-module-import-failed',
    message: `Failed to load app/routes.ts: ${message}`,
    severity: 'warn',
    suite: 'project-contract',
  }
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
