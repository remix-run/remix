import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isAbsoluteFilePath,
  normalizeFilePath,
  normalizePathname,
  normalizeWindowsPath,
  resolveFilePath,
} from './paths.ts'

describe('paths', () => {
  it('normalizes windows separators and uppercases drive letters', () => {
    assert.equal(
      normalizeWindowsPath(String.raw`c:\Users\runner\project`),
      'C:/Users/runner/project',
    )
    assert.equal(normalizeWindowsPath(String.raw`\\server\share\file.ts`), '//server/share/file.ts')
    assert.equal(normalizeWindowsPath(String.raw`C:\temp/mixed\path.ts`), 'C:/temp/mixed/path.ts')
  })

  it('normalizes URL pathnames consistently', () => {
    assert.equal(normalizePathname('assets\\app\\entry.ts'), '/assets/app/entry.ts')
    assert.equal(normalizePathname('/assets/app/../app/entry.ts'), '/assets/app/entry.ts')
    assert.equal(normalizePathname('./assets//app/./entry.ts'), '/assets/app/entry.ts')
  })

  it('detects absolute file paths across platforms', () => {
    assert.equal(isAbsoluteFilePath('/Users/runner/project'), true)
    assert.equal(isAbsoluteFilePath(String.raw`C:\Users\runner\project`), true)
    assert.equal(isAbsoluteFilePath(String.raw`\\server\share\project`), true)
    assert.equal(isAbsoluteFilePath('C:'), false)
    assert.equal(isAbsoluteFilePath('app/entry.ts'), false)
  })

  it('normalizes absolute file paths to a standard internal form', () => {
    assert.equal(normalizeFilePath(String.raw`C:\Users\runner\project`), 'C:/Users/runner/project')
    assert.equal(normalizeFilePath('/Users/runner/project'), '/Users/runner/project')
    assert.equal(
      normalizeFilePath(String.raw`c:\Users\runner\..\runner\project`),
      'C:/Users/runner/project',
    )
    assert.equal(normalizeFilePath(String.raw`C:\temp/mixed\path.ts`), 'C:/temp/mixed/path.ts')
  })

  it('preserves UNC roots when normalizing file paths', () => {
    assert.equal(
      normalizeFilePath(String.raw`\\server\share\folder\..\file.ts`),
      '//server/share/file.ts',
    )
    assert.equal(
      normalizeFilePath(String.raw`\\.\c:\temp\folder\..\file.ts`),
      '//./c:/temp/file.ts',
    )
  })

  it('resolves relative file paths from a normalized root', () => {
    assert.equal(
      resolveFilePath('C:/Users/runner/project', String.raw`app\entry.ts`),
      'C:/Users/runner/project/app/entry.ts',
    )
    assert.equal(
      resolveFilePath('/Users/runner/project', 'app/entry.ts'),
      '/Users/runner/project/app/entry.ts',
    )
    assert.equal(
      resolveFilePath('/Users/runner/project', './app/../app/entry.ts'),
      '/Users/runner/project/app/entry.ts',
    )
  })

  it('preserves already-absolute file paths when resolving', () => {
    assert.equal(
      resolveFilePath('C:/Users/runner/project', String.raw`D:\work\entry.ts`),
      'D:/work/entry.ts',
    )
  })

  it('resolves relative file paths from UNC roots', () => {
    assert.equal(
      resolveFilePath('//server/share/project', String.raw`app\entry.ts`),
      '//server/share/project/app/entry.ts',
    )
    assert.equal(
      resolveFilePath('//./c:/temp/project', './app/../app/entry.ts'),
      '//./c:/temp/project/app/entry.ts',
    )
  })
})
