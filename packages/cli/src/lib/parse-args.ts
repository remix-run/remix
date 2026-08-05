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
    let equalsIndex = arg.indexOf('=')
    let flag = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex)
    let inlineValue = equalsIndex === -1 ? undefined : arg.slice(equalsIndex + 1)
    let resolved = specsByFlag.get(flag)

    if (resolved != null) {
      if (resolved.spec.type === 'boolean') {
        if (inlineValue !== undefined) {
          throw unknownArgument(arg)
        }

        values[resolved.key] = true as ParsedArgsValues<definitions>[typeof resolved.key]
        continue
      }

      if (inlineValue !== undefined) {
        if (inlineValue.length === 0) {
          throw missingOptionValue(flag)
        }

        values[resolved.key] = inlineValue as ParsedArgsValues<definitions>[typeof resolved.key]
        continue
      }

      let next = argv[index + 1]
      if (next == null || next.startsWith('-')) {
        throw missingOptionValue(flag)
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
