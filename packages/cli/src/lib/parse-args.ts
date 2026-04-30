import { missingOptionValue, unexpectedExtraArgument, unknownArgument } from './errors.ts'

export interface ParseArgsBooleanOptionSpec {
  flag: string
  type: 'boolean'
}

export interface ParseArgsStringOptionSpec {
  flag: string
  type: 'string'
}

export type ParseArgsOptionSpec = ParseArgsBooleanOptionSpec | ParseArgsStringOptionSpec

export type ParseArgsOptionDefinitions = Record<string, ParseArgsOptionSpec>

export interface ParseArgsOptions {
  maxPositionals?: number
}

export type ParsedArgsValues<definitions extends ParseArgsOptionDefinitions> = {
  [key in keyof definitions]: definitions[key]['type'] extends 'boolean'
    ? boolean
    : string | undefined
}

export interface ParsedArgsResult<definitions extends ParseArgsOptionDefinitions> {
  options: ParsedArgsValues<definitions>
  positionals: string[]
}

export function parseArgs<const definitions extends ParseArgsOptionDefinitions>(
  argv: string[],
  definitions: definitions,
  options: ParseArgsOptions = {},
): ParsedArgsResult<definitions> {
  let values = {} as ParsedArgsValues<definitions>
  let specsByFlag = new Map<string, { key: keyof definitions; spec: ParseArgsOptionSpec }>()
  let positionals: string[] = []

  for (let [key, spec] of Object.entries(definitions) as Array<
    [keyof definitions, ParseArgsOptionSpec]
  >) {
    values[key] = (
      spec.type === 'boolean' ? false : undefined
    ) as ParsedArgsValues<definitions>[typeof key]
    specsByFlag.set(spec.flag, { key, spec })
  }

  for (let index = 0; index < argv.length; index++) {
    let arg = argv[index]!
    let resolved = specsByFlag.get(arg)

    if (resolved != null) {
      if (resolved.spec.type === 'boolean') {
        values[resolved.key] = true as ParsedArgsValues<definitions>[typeof resolved.key]
        continue
      }

      let next = argv[index + 1]
      if (next == null || next.startsWith('-')) {
        throw missingOptionValue(arg)
      }

      values[resolved.key] = next as ParsedArgsValues<definitions>[typeof resolved.key]
      index += 1
      continue
    }

    if (arg.startsWith('-')) {
      throw unknownArgument(arg)
    }

    if (options.maxPositionals != null && positionals.length >= options.maxPositionals) {
      throw unexpectedExtraArgument(arg)
    }

    positionals.push(arg)
  }

  return { options: values, positionals }
}
