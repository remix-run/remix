import * as fs from 'node:fs'
import * as path from 'node:path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

export const packagesDir = path.relative(
  process.cwd(),
  path.resolve(__dirname, '..', '..', 'packages'),
)

/** @type () => string[] */
export function getAllPackageNames() {
  return fs.readdirSync(packagesDir).filter((name) => {
    let dir = getPackageDir(name)
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory()
  })
}

/** @type (packageName: string) => string */
export function getPackageDir(packageName) {
  return path.resolve(packagesDir, packageName)
}

/** @type (packageName: string) => boolean */
export function packageExists(packageName) {
  return fs.existsSync(getPackageDir(packageName))
}

/** @type (packageName: string, filename: string) => string */
export function getPackageFile(packageName, filename) {
  return path.join(getPackageDir(packageName), filename)
}
