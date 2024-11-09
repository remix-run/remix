import * as path from 'node:path';
import { openFile } from '@mjackson/lazy-file/fs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const fixturesDir = path.resolve(__dirname, 'fixtures');

export function openFixture(name: string): File {
  return openFile(path.join(fixturesDir, name));
}
