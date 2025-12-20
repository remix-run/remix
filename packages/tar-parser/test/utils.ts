import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openLazyFile } from '@remix-run/fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, 'fixtures')

export const fixtures = {
  base256Size: path.resolve(fixturesDir, 'base-256-size.tar'),
  base256UidGid: path.resolve(fixturesDir, 'base-256-uid-gid.tar'),
  expressNpmPackage: path.resolve(fixturesDir, 'express-4.21.1.tgz'),
  fetchProxyGithubArchive: path.resolve(fixturesDir, 'fetch-proxy-0.1.0.tar.gz'),
  gnuIncremental: path.resolve(fixturesDir, 'gnu-incremental.tar'),
  gnuLongPath: path.resolve(fixturesDir, 'gnu-long-path.tar'),
  gnu: path.resolve(fixturesDir, 'gnu.tar'),
  incomplete: path.resolve(fixturesDir, 'incomplete.tar'),
  latin1: path.resolve(fixturesDir, 'latin1.tar'),
  lodashNpmPackage: path.resolve(fixturesDir, 'lodash-4.17.21.tgz'),
  longName: path.resolve(fixturesDir, 'long-name.tar'),
  multiFile: path.resolve(fixturesDir, 'multi-file.tar'),
  npmNpmPackage: path.resolve(fixturesDir, 'npm-11.0.0.tgz'),
  nameIs100: path.resolve(fixturesDir, 'name-is-100.tar'),
  oneFile: path.resolve(fixturesDir, 'one-file.tar'),
  pax: path.resolve(fixturesDir, 'pax.tar'),
  space: path.resolve(fixturesDir, 'space.tar'),
  types: path.resolve(fixturesDir, 'types.tar'),
  unicodeBsd: path.resolve(fixturesDir, 'unicode-bsd.tar'),
  unicode: path.resolve(fixturesDir, 'unicode.tar'),
}

export function readFixture(filename: string): ReadableStream<Uint8Array> {
  let stream = openLazyFile(filename).stream()
  return filename.endsWith('.tar.gz') || filename.endsWith('.tgz')
    ? stream.pipeThrough(new DecompressionStream('gzip'))
    : stream
}
