import * as fs from 'node:fs';
import * as path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const packagesDir = path.relative(
  process.cwd(),
  path.resolve(__dirname, '..', '..', 'packages'),
);

export function getAllPackageNames(): string[] {
  return fs.readdirSync(packagesDir).filter((name) => {
    let dir = getPackageDir(name);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  });
}

export function getPackageDir(packageName: string): string {
  return path.resolve(packagesDir, packageName);
}

export function packageExists(packageName: string): boolean {
  return fs.existsSync(getPackageDir(packageName));
}

export function getPackageFile(packageName: string, filename: string): string {
  return path.join(getPackageDir(packageName), filename);
}
