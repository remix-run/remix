import * as fs from 'node:fs';

/** @type (filename: string) => boolean */
export function fileExists(filename) {
  return fs.existsSync(filename);
}

/** @type (filename: string, encoding?: BufferEncoding) => string */
export function readFile(filename, encoding = 'utf-8') {
  try {
    return fs.readFileSync(filename, encoding);
  } catch (error) {
    if (isFsError(error) && error.code === 'ENOENT') {
      console.error(`Not found: "${filename}"`);
      process.exit(1);
    } else {
      throw error;
    }
  }
}

/** @type (filename: string, data: string) => void */
export function writeFile(filename, data) {
  fs.writeFileSync(filename, data);
}

/** @type (filename: string) => any */
export function readJson(filename) {
  return JSON.parse(readFile(filename));
}

/** @type (filename: string, data: any) => void */
export function writeJson(filename, data) {
  writeFile(filename, JSON.stringify(data, null, 2) + '\n');
}

/** @type (error: unknown) => error is { code: string } */
function isFsError(error) {
  return (
    typeof error === 'object' && error != null && 'code' in error && typeof error.code === 'string'
  );
}
