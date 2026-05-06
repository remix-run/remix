import * as process from 'node:process'

import { configureColors } from '../src/lib/terminal.ts'

type EnvOverrides = Record<string, string | undefined>

export function withEnv<result>(env: EnvOverrides, callback: () => Promise<result>): Promise<result>
export function withEnv<result>(env: EnvOverrides, callback: () => result): result
export function withEnv<result>(
  env: EnvOverrides,
  callback: () => Promise<result> | result,
): Promise<result> | result {
  let previousValues = new Map<string, string | undefined>()

  for (let [name, value] of Object.entries(env)) {
    previousValues.set(name, process.env[name])

    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }

  let restoreEnv = () => {
    for (let [name, value] of previousValues) {
      if (value === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = value
      }
    }

    configureColors({ disabled: false })
  }

  try {
    let result = callback()

    if (result instanceof Promise) {
      return result.finally(restoreEnv)
    }

    restoreEnv()
    return result
  } catch (error) {
    restoreEnv()
    throw error
  }
}
