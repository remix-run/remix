import * as path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const packagesDir = path.relative(
  process.cwd(),
  path.resolve(__dirname, '..', '..', 'packages'),
);

/** @type (packageName: string) => string */
export function getPackageDir(packageName) {
  return path.resolve(packagesDir, packageName);
}

/** @type (packageName: string, filename: string) => string */
export function getPackageFile(packageName, filename) {
  return path.join(getPackageDir(packageName), filename);
}
