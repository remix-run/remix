import { testCommandFlags } from './commands/test.ts'

export interface CompletionResult {
  mode: 'files' | 'none' | 'values'
  values?: string[]
}

const COMPLETION_SHELLS = ['bash', 'zsh'] as const
const DB_COMMANDS = ['migrate', 'reset', 'seed', 'status', 'wipe'] as const
const HELP_COMMANDS = [
  'completion',
  'db',
  'doctor',
  'help',
  'new',
  'routes',
  'test',
  'version',
] as const
const ROOT_COMMANDS = [
  'completion',
  'db',
  'doctor',
  'help',
  'new',
  'routes',
  'test',
  'version',
] as const

// Derived from the `remix test` flag table so completion stays in sync with
// argument parsing and help text.
const TEST_BOOLEAN_FLAGS = testCommandFlags
  .filter((flag) => flag.type === 'boolean')
  .map((flag) => flag.name)
const TEST_VALUE_FLAGS = testCommandFlags
  .filter((flag) => flag.type === 'string')
  .map((flag) => flag.name)
const TEST_BOOLEAN_FLAG_SET = new Set(TEST_BOOLEAN_FLAGS)
const TEST_VALUE_FLAG_SET = new Set(TEST_VALUE_FLAGS)
const TEST_REPEATABLE_FLAGS = new Set(
  testCommandFlags.filter((flag) => flag.multiple).map((flag) => flag.name),
)
const TEST_FILE_VALUE_FLAGS = new Set(
  testCommandFlags.filter((flag) => flag.files).map((flag) => flag.name),
)
const TEST_FLAG_ALIASES = new Map(
  testCommandFlags.flatMap((flag) =>
    flag.alias === undefined ? [] : [[flag.alias, flag.name] as const],
  ),
)

export type CompletionShell = (typeof COMPLETION_SHELLS)[number]

export function isCompletionShell(value: string): value is CompletionShell {
  return COMPLETION_SHELLS.includes(value as CompletionShell)
}

export function getCompletionResult(words: string[], currentIndex: number): CompletionResult {
  let resolvedIndex = Math.max(0, currentIndex)
  let currentWord = words[resolvedIndex] ?? ''
  let tokens = getTokensBeforeCursor(words, resolvedIndex)

  if (currentWord.startsWith('--config=')) {
    return { mode: 'files' }
  }

  return completeTopLevel(tokens, currentWord)
}

export function renderCompletionResult(result: CompletionResult): string {
  let lines = [`mode:${result.mode}`]

  if (result.mode === 'values') {
    lines.push(...(result.values ?? []))
  }

  return `${lines.join('\n')}\n`
}

export function getCompletionScript(): string {
  return `###-begin-remix-completion-###
#
# Remix command completion script
#
# Installation:
#   remix completion bash >> ~/.bashrc
#   remix completion zsh >> ~/.zshrc
#

if type complete &>/dev/null; then
  _remix_completion() {
    local words cword current output mode si
    local lines

    if type _get_comp_words_by_ref &>/dev/null; then
      # -n = keeps --config=<path> together as one word; bash's default
      # COMP_WORDBREAKS would otherwise split it at the equals sign.
      _get_comp_words_by_ref -n = -w words -i cword
    else
      cword="$COMP_CWORD"
      words=("\${COMP_WORDS[@]}")
    fi

    current="\${words[cword]}"
    output=$(remix completion -- "$cword" "\${words[@]}" 2>/dev/null) || return 0
    si="$IFS"
    IFS=$'\\n' lines=($output)
    IFS="$si"
    mode="\${lines[0]}"

    if [[ "$mode" == "mode:values" ]]; then
      COMPREPLY=("\${lines[@]:1}")
      return 0
    fi

    if [[ "$mode" == "mode:files" ]]; then
      if [[ "$current" == --config=* ]]; then
        # Readline still breaks the insertion point at '=', so complete the
        # path portion alone; prefixing --config= would duplicate the flag.
        local config_value
        config_value="\${current#--config=}"
        COMPREPLY=($(compgen -f -- "$config_value"))
      else
        COMPREPLY=($(compgen -f -- "$current"))
      fi
      return 0
    fi

    COMPREPLY=()
  }

  complete -o default -F _remix_completion remix
elif type compdef &>/dev/null; then
  _remix_completion() {
    local output mode
    local -a lines values

    output=$(remix completion -- "$((CURRENT - 1))" "\${words[@]}" 2>/dev/null) || return 0
    lines=("\${(@f)output}")
    mode="\${lines[1]}"

    if [[ "$mode" == "mode:values" ]]; then
      values=("\${(@)lines[2,-1]}")
      if (( \${#values[@]} > 0 )); then
        compadd -- "\${values[@]}"
      fi
      return 0
    fi

    if [[ "$mode" == "mode:files" ]]; then
      if [[ "\${words[CURRENT]}" == --config=* ]]; then
        compset -P '--config='
      fi
      if autoload -U +X _files 2>/dev/null; then
        _files
      else
        compadd -f
      fi
      return 0
    fi

    return 0
  }

  compdef _remix_completion remix
fi
###-end-remix-completion-###
`
}

function completeTopLevel(tokens: string[], currentWord: string): CompletionResult {
  let usedFlags = new Set<string>()
  let index = 0

  while (index < tokens.length) {
    let token = tokens[index]

    if (token === '--config') {
      usedFlags.add('--config')
      if (tokens[index + 1] === undefined) return { mode: 'files' }
      index += 2
      continue
    }

    if (token.startsWith('--config=')) {
      usedFlags.add('--config')
      index++
      continue
    }

    if (token === '--no-color') {
      usedFlags.add('--no-color')
      index++
      continue
    }

    if (token === '-h' || token === '--help') {
      usedFlags.add('-h')
      return completeValues([], currentWord)
    }

    if (token === '-v' || token === '--version') {
      usedFlags.add('-v')
      return completeValues([], currentWord)
    }

    return completeCommand(token, tokens.slice(index + 1), currentWord, usedFlags)
  }

  return completeValues(getTopLevelSuggestions(currentWord, usedFlags), currentWord)
}

function completeCommand(
  command: string,
  tokens: string[],
  currentWord: string,
  usedGlobalFlags: Set<string>,
): CompletionResult {
  if (expectsGlobalConfigValue(tokens)) {
    return { mode: 'files' }
  }

  if (command === 'help') {
    return completeHelp(tokens, currentWord, usedGlobalFlags)
  }

  if (command === 'new') {
    return completeNew(tokens, currentWord, usedGlobalFlags)
  }

  if (command === 'db') {
    return completeDb(tokens, currentWord, usedGlobalFlags)
  }

  if (command === 'doctor') {
    return completeSimpleFlags(tokens, currentWord, usedGlobalFlags, [
      '--fix',
      '--json',
      '--strict',
      '--no-strict',
    ])
  }

  if (command === 'routes') {
    return completeRoutes(tokens, currentWord, usedGlobalFlags)
  }

  if (command === 'version') {
    return completeSimpleFlags(tokens, currentWord, usedGlobalFlags, [])
  }

  if (command === 'test') {
    return completeTest(tokens, currentWord, usedGlobalFlags)
  }

  if (command === 'completion') {
    return completeCompletionCommand(tokens, currentWord, usedGlobalFlags)
  }

  return completeValues([], currentWord)
}

function completeTest(
  tokens: string[],
  currentWord: string,
  usedGlobalFlags: Set<string>,
): CompletionResult {
  let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags)
  if (filteredTokens == null) {
    return completeValues([], currentWord)
  }

  let usedFlags = new Set<string>()
  let expectedValueFor: string | undefined
  let afterSeparator = false

  for (let token of filteredTokens) {
    if (expectedValueFor != null) {
      expectedValueFor = undefined
      continue
    }

    // Everything after a bare `--` is a positional test file glob
    if (afterSeparator) {
      continue
    }

    if (token === '--') {
      afterSeparator = true
      continue
    }

    if (token.startsWith('--')) {
      // `--flag=value` carries its value inline
      let equalsIndex = token.indexOf('=')
      let flag = equalsIndex === -1 ? token : token.slice(0, equalsIndex)

      if (TEST_VALUE_FLAG_SET.has(flag)) {
        usedFlags.add(flag)
        if (equalsIndex === -1) {
          expectedValueFor = flag
        }
        continue
      }

      if (TEST_BOOLEAN_FLAG_SET.has(flag)) {
        usedFlags.add(flag)
        continue
      }

      return completeValues([], currentWord)
    }

    if (token.startsWith('-') && token !== '-') {
      let aliased = TEST_FLAG_ALIASES.get(token.slice(0, 2))

      // A value alias may carry its value inline (`-c1`); a bare alias
      // expects the value in the next token.
      if (aliased !== undefined && TEST_VALUE_FLAG_SET.has(aliased)) {
        usedFlags.add(aliased)
        if (token.length === 2) {
          expectedValueFor = aliased
        }
        continue
      }

      // A group of boolean aliases (`-qw`)
      let group = [...token.slice(1)].map((char) => TEST_FLAG_ALIASES.get(`-${char}`))
      if (
        group.every((flag): flag is string => flag !== undefined && TEST_BOOLEAN_FLAG_SET.has(flag))
      ) {
        for (let flag of group) {
          usedFlags.add(flag)
        }
        continue
      }

      return completeValues([], currentWord)
    }

    // Anything else is a positional test file glob
  }

  if (expectedValueFor != null) {
    return TEST_FILE_VALUE_FLAGS.has(expectedValueFor) ? { mode: 'files' } : { mode: 'none' }
  }

  if (afterSeparator) {
    return { mode: 'files' }
  }

  let longFlags = [...TEST_BOOLEAN_FLAGS, ...TEST_VALUE_FLAGS].filter(
    (flag) => !usedFlags.has(flag) || TEST_REPEATABLE_FLAGS.has(flag),
  )
  let shortFlags = [...TEST_FLAG_ALIASES].flatMap(([short, long]) =>
    !usedFlags.has(long) || TEST_REPEATABLE_FLAGS.has(long) ? [short] : [],
  )
  let suggestions = withHelpFlags([...longFlags, ...shortFlags], usedGlobalFlags)

  return currentWord.startsWith('-') || currentWord === ''
    ? completeValues(suggestions, currentWord)
    : { mode: 'files' }
}

function completeHelp(
  tokens: string[],
  currentWord: string,
  usedGlobalFlags: Set<string>,
): CompletionResult {
  let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags)
  if (filteredTokens == null) {
    return completeValues([], currentWord)
  }

  if (filteredTokens.length === 0) {
    return completeValues(withHelpFlags([...HELP_COMMANDS], usedGlobalFlags), currentWord)
  }

  let [, ...rest] = filteredTokens
  if (rest.length === 0) {
    return completeValues([], currentWord)
  }

  return completeValues([], currentWord)
}

function completeNew(
  tokens: string[],
  currentWord: string,
  usedGlobalFlags: Set<string>,
): CompletionResult {
  let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags)
  if (filteredTokens == null) {
    return completeValues([], currentWord)
  }

  let hasAppName = false
  let hasForce = false
  let hasTargetDir = false
  let expectsAppName = false

  for (let token of filteredTokens) {
    if (expectsAppName) {
      expectsAppName = false
      continue
    }

    if (token === '--app-name') {
      hasAppName = true
      expectsAppName = true
      continue
    }

    if (token === '--force') {
      hasForce = true
      continue
    }

    if (token.startsWith('-')) {
      return completeValues([], currentWord)
    }

    if (!hasTargetDir) {
      hasTargetDir = true
      continue
    }

    return completeValues([], currentWord)
  }

  if (expectsAppName) {
    return { mode: 'none' }
  }

  let flags = withHelpFlags(
    [...(!hasAppName ? ['--app-name'] : []), ...(!hasForce ? ['--force'] : [])],
    usedGlobalFlags,
  )

  if (!hasTargetDir && !currentWord.startsWith('-')) {
    return { mode: 'files' }
  }

  return completeValues(flags, currentWord)
}

function completeRoutes(
  tokens: string[],
  currentWord: string,
  usedGlobalFlags: Set<string>,
): CompletionResult {
  let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags)
  if (filteredTokens == null) {
    return completeValues([], currentWord)
  }

  let hasJson = false
  let hasNoHeaders = false
  let hasTable = false
  let hasVerbose = false

  for (let token of filteredTokens) {
    if (token === '--json') {
      hasJson = true
      continue
    }

    if (token === '--table') {
      hasTable = true
      continue
    }

    if (token === '--no-headers') {
      hasNoHeaders = true
      continue
    }

    if (token === '--verbose') {
      hasVerbose = true
      continue
    }

    return completeValues([], currentWord)
  }

  let flags = withHelpFlags(
    [
      ...(!hasJson && !hasTable && !hasVerbose ? ['--json'] : []),
      ...(!hasTable && !hasJson ? ['--table'] : []),
      ...(!hasNoHeaders && hasTable ? ['--no-headers'] : []),
      ...(!hasVerbose && !hasJson ? ['--verbose'] : []),
    ],
    usedGlobalFlags,
  )

  return completeValues(flags, currentWord)
}

function completeDb(
  tokens: string[],
  currentWord: string,
  usedGlobalFlags: Set<string>,
): CompletionResult {
  let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags)
  if (filteredTokens == null) {
    return completeValues([], currentWord)
  }

  if (filteredTokens.length === 0) {
    return completeValues(withHelpFlags([...DB_COMMANDS], usedGlobalFlags), currentWord)
  }

  let [subcommand, ...rest] = filteredTokens

  if (subcommand === 'migrate') {
    return completeDbOptions(
      rest,
      currentWord,
      usedGlobalFlags,
      [],
      ['--connection-env', '--journal-table', '--migrations', '--to'],
    )
  }

  if (subcommand === 'reset') {
    return completeDbOptions(
      rest,
      currentWord,
      usedGlobalFlags,
      ['--force'],
      ['--connection-env', '--journal-table', '--migrations', '--seed'],
    )
  }

  if (subcommand === 'wipe') {
    return completeDbOptions(rest, currentWord, usedGlobalFlags, ['--force'], ['--connection-env'])
  }

  if (subcommand === 'seed') {
    return completeDbOptions(rest, currentWord, usedGlobalFlags, [], ['--connection-env', '--seed'])
  }

  if (subcommand === 'status') {
    return completeDbOptions(
      rest,
      currentWord,
      usedGlobalFlags,
      [],
      ['--connection-env', '--journal-table', '--migrations'],
    )
  }

  return completeValues([], currentWord)
}

function completeDbOptions(
  tokens: string[],
  currentWord: string,
  usedGlobalFlags: Set<string>,
  booleanFlags: string[],
  valueFlags: string[],
): CompletionResult {
  let usedFlags = new Set<string>()
  let expectedValueFor: string | undefined

  for (let token of tokens) {
    if (expectedValueFor !== undefined) {
      expectedValueFor = undefined
      continue
    }

    let equalsIndex = token.indexOf('=')
    let flag = equalsIndex === -1 ? token : token.slice(0, equalsIndex)
    if (booleanFlags.includes(flag)) {
      usedFlags.add(flag)
      continue
    }

    if (valueFlags.includes(flag)) {
      usedFlags.add(flag)
      if (equalsIndex === -1) expectedValueFor = flag
      continue
    }

    return completeValues([], currentWord)
  }

  if (expectedValueFor !== undefined) {
    return expectedValueFor === '--migrations' || expectedValueFor === '--seed'
      ? { mode: 'files' }
      : { mode: 'none' }
  }

  let available = [...booleanFlags, ...valueFlags].filter((flag) => !usedFlags.has(flag))
  return completeValues(withHelpFlags(available, usedGlobalFlags), currentWord)
}

function completeCompletionCommand(
  tokens: string[],
  currentWord: string,
  usedGlobalFlags: Set<string>,
): CompletionResult {
  let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags)
  if (filteredTokens == null) {
    return completeValues([], currentWord)
  }

  if (filteredTokens.length === 0) {
    return completeValues(withHelpFlags([...COMPLETION_SHELLS], usedGlobalFlags), currentWord)
  }

  return completeValues([], currentWord)
}

function completeSimpleFlags(
  tokens: string[],
  currentWord: string,
  usedGlobalFlags: Set<string>,
  commandFlags: string[],
): CompletionResult {
  let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags)
  if (filteredTokens == null) {
    return completeValues([], currentWord)
  }

  let usedFlags = new Set<string>()
  for (let token of filteredTokens) {
    if (!commandFlags.includes(token)) {
      return completeValues([], currentWord)
    }

    usedFlags.add(token)
  }

  let availableFlags = commandFlags.filter((flag) => !usedFlags.has(flag))
  return completeValues(withHelpFlags(availableFlags, usedGlobalFlags), currentWord)
}

function getTopLevelSuggestions(currentWord: string, usedFlags: Set<string>): string[] {
  let flags = [
    ...(!usedFlags.has('--config') ? ['--config'] : []),
    ...(!usedFlags.has('-h') ? ['-h', '--help'] : []),
    ...(!usedFlags.has('--no-color') ? ['--no-color'] : []),
    ...(!usedFlags.has('-v') ? ['-v', '--version'] : []),
  ]

  if (currentWord.startsWith('-')) {
    return flags
  }

  return [...ROOT_COMMANDS, ...flags]
}

function withHelpFlags(values: string[], usedGlobalFlags: Set<string>): string[] {
  return [
    ...values,
    ...(!usedGlobalFlags.has('--config') ? ['--config'] : []),
    ...(!usedGlobalFlags.has('-h') ? ['-h', '--help'] : []),
    ...(!usedGlobalFlags.has('--no-color') ? ['--no-color'] : []),
  ]
}

function filterGlobalCommandTokens(
  tokens: string[],
  usedGlobalFlags: Set<string>,
): string[] | null {
  let filtered: string[] = []

  for (let index = 0; index < tokens.length; index++) {
    let token = tokens[index]!

    if (token === '--config') {
      usedGlobalFlags.add('--config')
      index++
      continue
    }

    if (token.startsWith('--config=')) {
      usedGlobalFlags.add('--config')
      continue
    }

    if (token === '--no-color') {
      usedGlobalFlags.add('--no-color')
      continue
    }

    if (token === '-h' || token === '--help') {
      usedGlobalFlags.add('-h')
      return null
    }

    filtered.push(token)
  }

  return filtered
}

function expectsGlobalConfigValue(tokens: string[]): boolean {
  let expectsValue = false

  for (let token of tokens) {
    if (expectsValue) {
      expectsValue = false
      continue
    }

    if (token === '--config') {
      expectsValue = true
    }
  }

  return expectsValue
}

function completeValues(values: string[], currentWord: string): CompletionResult {
  return {
    mode: 'values',
    values: values.filter((value) => value.startsWith(currentWord)),
  }
}

function getTokensBeforeCursor(words: string[], currentIndex: number): string[] {
  let startIndex = words[0] === 'remix' ? 1 : 0
  let endIndex = Math.max(startIndex, Math.min(currentIndex, words.length))

  return words.slice(startIndex, endIndex)
}
