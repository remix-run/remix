import * as fs from 'node:fs';
import * as path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export function readFixture(name: string): Uint8Array {
  let file = path.resolve(__dirname, `./fixtures/${name}`);
  let buffer = fs.readFileSync(file);
  return new Uint8Array(buffer);
}
