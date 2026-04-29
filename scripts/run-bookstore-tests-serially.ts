import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

type TestType = 'server' | 'browser' | 'e2e'

type BookstoreTest = {
  file: string
  type: TestType
}

const repoRoot = process.cwd()
const bookstoreRoot = path.join(repoRoot, 'demos', 'bookstore')
const appRoot = path.join(bookstoreRoot, 'app')

function main() {
  let tests = getBookstoreTests()

  if (tests.length === 0) {
    throw new Error(`No bookstore tests found in ${appRoot}`)
  }

  console.log('Running bookstore tests one file at a time:')
  for (let test of tests) {
    console.log(`- ${test.type}: ${test.file}`)
  }
  console.log()

  for (let test of tests) {
    runBookstoreTest(test)
  }
}

function getBookstoreTests(): BookstoreTest[] {
  let testFiles = getTestFiles(appRoot)

  return testFiles
    .map((file) => ({
      file: toPosixPath(path.relative(bookstoreRoot, file)),
      type: getTestType(file),
    }))
    .sort((a, b) => {
      let typeOrder = getTypeOrder(a.type) - getTypeOrder(b.type)
      return typeOrder === 0 ? a.file.localeCompare(b.file) : typeOrder
    })
}

function getTestFiles(dir: string): string[] {
  let entries = fs.readdirSync(dir, { withFileTypes: true })
  let testFiles: string[] = []

  for (let entry of entries) {
    let file = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      testFiles.push(...getTestFiles(file))
      continue
    }

    if (entry.isFile() && /\.test(?:\.(?:browser|e2e))?\.tsx?$/.test(entry.name)) {
      testFiles.push(file)
    }
  }

  return testFiles
}

function getTestType(file: string): TestType {
  if (/\.test\.browser\.tsx?$/.test(file)) {
    return 'browser'
  }

  if (/\.test\.e2e\.tsx?$/.test(file)) {
    return 'e2e'
  }

  return 'server'
}

function getTypeOrder(type: TestType): number {
  switch (type) {
    case 'server':
      return 0
    case 'browser':
      return 1
    case 'e2e':
      return 2
  }
}

function toPosixPath(file: string): string {
  return file.split(path.sep).join('/')
}

function runBookstoreTest(test: BookstoreTest) {
  console.log(`\nRunning bookstore ${test.type} test: ${test.file}`)

  let result = cp.spawnSync(
    'pnpm',
    [
      '--filter',
      'bookstore-demo',
      'exec',
      'node',
      '../../packages/remix/src/cli-entry.ts',
      'test',
      test.file,
      '--type',
      test.type,
      '--concurrency',
      '1',
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  )

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

main()
