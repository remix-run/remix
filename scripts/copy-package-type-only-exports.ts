import fs from 'node:fs/promises'
import path from 'node:path'

type PackageJson = {
  exports?: Record<string, ExportConfig>
  publishConfig?: {
    exports?: Record<string, ExportConfig>
  }
}

type ExportConfig = string | Record<string, unknown>

const packageDirArg = process.argv[2]
if (!packageDirArg) {
  throw new Error('Usage: node scripts/copy-package-type-only-exports.ts <package-dir>')
}

const packageDir = path.resolve(packageDirArg)
const packageJsonPath = path.join(packageDir, 'package.json')
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as PackageJson
const sourceExports = packageJson.exports ?? {}
const publishExports = packageJson.publishConfig?.exports ?? {}

for (let [exportPath, sourceConfig] of Object.entries(sourceExports)) {
  let publishConfig = publishExports[exportPath]
  let sourceTypes = getTypeOnlyExportTarget(sourceConfig)
  let publishTypes = getTypeOnlyExportTarget(publishConfig)

  if (!sourceTypes) {
    continue
  }

  if (!publishTypes) {
    throw new Error(`Missing publishConfig type-only export for "${exportPath}"`)
  }

  let sourcePath = path.join(packageDir, sourceTypes)
  let publishPath = path.join(packageDir, publishTypes)
  await fs.mkdir(path.dirname(publishPath), { recursive: true })
  await fs.copyFile(sourcePath, publishPath)
}

function getTypeOnlyExportTarget(config: ExportConfig | undefined): string | null {
  if (!isRecord(config)) {
    return null
  }

  let keys = Object.keys(config)
  if (keys.length !== 1 || keys[0] !== 'types') {
    return null
  }

  return typeof config.types === 'string' ? config.types : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
