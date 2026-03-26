#!/usr/bin/env node
import * as process from 'node:process'
import { pathToFileURL } from 'node:url'

export { run } from './lib/cli.ts'
import { run } from './lib/cli.ts'

function isExecutedDirectly(metaUrl: string): boolean {
  return process.argv[1] != null && metaUrl === pathToFileURL(process.argv[1]).href
}

if (isExecutedDirectly(import.meta.url)) {
  void run().then(
    (exitCode) => {
      setExitCode(exitCode)
    },
    (error: unknown) => {
      console.error(error)
      setExitCode(1)
    },
  )
}

function setExitCode(exitCode: number) {
  let runtimeProcess = process
  Reflect.set(runtimeProcess, 'exitCode', exitCode)
}
