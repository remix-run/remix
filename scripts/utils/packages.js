import * as fs from 'node:fs';
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

/** @type (packageName: string) => boolean */
export function hasChangelog(packageName) {
  return fs.existsSync(getPackageFile(packageName, 'CHANGELOG.md'));
}

/** @type (packageName: string) => string */
export function readChangelog(packageName) {
  return fs.readFileSync(getPackageFile(packageName, 'CHANGELOG.md'), 'utf-8');
}

/** @type (packageName: string, data: string) => void */
export function writeChangelog(packageName, data) {
  fs.writeFileSync(getPackageFile(packageName, 'CHANGELOG.md'), data);
}

/** @type (packageName: string) => boolean */
export function hasJsrJson(packageName) {
  return fs.existsSync(getPackageFile(packageName, 'jsr.json'));
}

/** @type (packageName: string) => any */
export function readJsrJson(packageName) {
  return readJson(getPackageFile(packageName, 'jsr.json'));
}

/** @type (packageName: string, data: any) => void */
export function writeJsrJson(packageName, data) {
  writeJson(getPackageFile(packageName, 'jsr.json'), data);
}

/** @type (packageName: string) => boolean */
export function hasPackageJson(packageName) {
  return fs.existsSync(getPackageFile(packageName, 'package.json'));
}

/** @type (packageName: string) => any */
export function readPackageJson(packageName) {
  return readJson(getPackageFile(packageName, 'package.json'));
}

/** @type (packageName: string, data: any) => void */
export function writePackageJson(packageName, data) {
  writeJson(getPackageFile(packageName, 'package.json'), data);
}

/** @type (file: string) => any */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    if (isFsError(error) && error.code === 'ENOENT') {
      console.error(`Not found: "${file}"`);
      process.exit(1);
    } else {
      throw error;
    }
  }
}

/** @type (filename: string, data: any) => void */
function writeJson(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2) + '\n');
}

/** @type (error: unknown) => error is { code: string } */
function isFsError(error) {
  return (
    typeof error === 'object' && error != null && 'code' in error && typeof error.code === 'string'
  );
}
