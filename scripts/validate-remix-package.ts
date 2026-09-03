import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { cliSchemaPath } from './utils/remix-schema.ts'

const rootDir = path.resolve(import.meta.dirname, '..')
const remixDir = path.join(rootDir, 'packages', 'remix')

const requiredReadmePaths = [
  'package/src/assert/README.md',
  'package/src/fetch-router/README.md',
  'package/src/ui/popover/README.md',
]

const requiredTypeExportPaths = [
  'package/dist/assets/types/hmr.d.ts',
  'package/dist/node-hmr/types.d.ts',
]

const remixSchemaTarPath = 'package/schema/remix.json'

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-pack-'))

try {
  cp.execFileSync('pnpm', ['pack', '--pack-destination', packDir], {
    cwd: remixDir,
    stdio: 'inherit',
  })

  let tarballs = fs.readdirSync(packDir).filter((filename) => filename.endsWith('.tgz'))
  if (tarballs.length !== 1) {
    throw new Error(`Expected one remix package tarball, found ${tarballs.length}.`)
  }

  let tarballPath = path.join(packDir, tarballs[0])
  let packedFiles = new Set(
    cp
      .execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf-8' })
      .split(/\r?\n/)
      .filter(Boolean),
  )

  let missingReadmes = requiredReadmePaths.filter((readmePath) => !packedFiles.has(readmePath))
  if (missingReadmes.length > 0) {
    throw new Error(
      [
        'The remix package tarball is missing generated README mirrors:',
        ...missingReadmes.map((readmePath) => `- ${readmePath}`),
      ].join('\n'),
    )
  }

  let missingTypeExports = requiredTypeExportPaths.filter(
    (typeExportPath) => !packedFiles.has(typeExportPath),
  )
  if (missingTypeExports.length > 0) {
    throw new Error(
      [
        'The remix package tarball is missing declaration-only exports:',
        ...missingTypeExports.map((typeExportPath) => `- ${typeExportPath}`),
      ].join('\n'),
    )
  }

  if (!packedFiles.has(remixSchemaTarPath)) {
    throw new Error(`The remix package tarball is missing ${remixSchemaTarPath}.`)
  }

  let packedSchema = cp.execFileSync('tar', ['-xOzf', tarballPath, remixSchemaTarPath], {
    encoding: 'utf-8',
  })
  let canonicalSchema = fs.readFileSync(cliSchemaPath, 'utf-8')
  if (packedSchema !== canonicalSchema) {
    throw new Error('The remix package schema does not match the canonical CLI schema.')
  }

  console.log(
    'Verified generated README mirrors, declaration-only exports, and the Remix schema in the tarball.',
  )
} finally {
  fs.rmSync(packDir, { recursive: true, force: true })
}
