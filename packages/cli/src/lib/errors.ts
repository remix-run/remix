export interface CliErrorDefinition {
  code: string
  docsUrl?: string
  fix?: string
  title: string
}

export type CliErrorContext = Record<string, boolean | number | string | null | undefined>

export interface CliErrorOptions {
  code: string
  context?: CliErrorContext
  docsUrl?: string
  fix?: string
  message: string
  showHelp?: boolean
  title: string
}

interface CreateErrorOptions {
  context?: CliErrorContext
  message: string
}

export const CLI_ERROR_DEFINITIONS = {
  appNameUnavailable: {
    code: 'RMX_APP_NAME_UNAVAILABLE',
    title: 'Could not determine an app name',
    fix: 'Pass --app-name or choose a target directory name that can become an app name.',
  },
  remixVersionUnavailable: {
    code: 'RMX_REMIX_VERSION_UNAVAILABLE',
    title: 'Could not determine the Remix version',
  },
  invalidCompletionRequest: {
    code: 'RMX_INVALID_COMPLETION_REQUEST',
    title: 'Invalid completion request',
  },
  fetchUnavailable: {
    code: 'RMX_FETCH_UNAVAILABLE',
    title: 'This runtime does not provide fetch()',
    fix: 'Run the Remix CLI in a runtime that provides fetch().',
  },
  internalError: {
    code: 'RMX_INTERNAL_ERROR',
    title: 'Unexpected Remix CLI error',
  },
  invalidFlagCombination: {
    code: 'RMX_INVALID_FLAG_COMBINATION',
    title: 'Invalid flag combination',
    fix: 'Remove one of the conflicting flags and try again.',
  },
  invalidPackageName: {
    code: 'RMX_INVALID_PACKAGE_NAME',
    title: 'Could not derive a valid package name',
    fix: 'Choose an app name that can be normalized into a valid npm package name.',
  },
  missingOptionValue: {
    code: 'RMX_MISSING_OPTION_VALUE',
    title: 'Missing option value',
    fix: 'Pass a value immediately after the option.',
  },
  missingTargetDirectory: {
    code: 'RMX_MISSING_TARGET_DIRECTORY',
    title: 'Missing target directory',
    fix: 'Pass a target directory, for example `remix new my-remix-app`.',
  },
  projectRootNotFound: {
    code: 'RMX_PROJECT_ROOT_NOT_FOUND',
    title: 'Could not find a project root',
    fix: 'Run this command inside a Remix project.',
  },
  remoteSkillDataMissing: {
    code: 'RMX_REMOTE_SKILL_DATA_MISSING',
    title: 'Could not find remote Remix skill data',
  },
  routeMapLoaderFailed: {
    code: 'RMX_ROUTE_MAP_LOADER_FAILED',
    title: 'Route-map loader failed',
    fix: 'Check app/routes.ts and make sure it exports a named `routes` value with a valid route map.',
  },
  routeMapLoaderInvalidJson: {
    code: 'RMX_ROUTE_MAP_LOADER_INVALID_JSON',
    title: 'Route-map loader returned invalid JSON',
    fix: 'Check app/routes.ts and make sure route-map loading does not write extra output.',
  },
  routeMapLoaderSignal: {
    code: 'RMX_ROUTE_MAP_LOADER_SIGNAL',
    title: 'Route-map loader exited from a signal',
    fix: 'Check app/routes.ts for side effects or runtime issues and try again.',
  },
  routeOwnerPlanUnresolved: {
    code: 'RMX_ROUTE_OWNER_PLAN_UNRESOLVED',
    title: 'Could not resolve a route owner plan',
  },
  routesFileNotFound: {
    code: 'RMX_ROUTES_FILE_NOT_FOUND',
    title: 'Could not find app/routes.ts',
    fix: 'Run this command inside a Remix app that has app/routes.ts.',
  },
  targetDirectoryNotEmpty: {
    code: 'RMX_TARGET_DIRECTORY_NOT_EMPTY',
    title: 'Target directory is not empty',
    fix: 'Re-run with --force to continue.',
  },
  targetPathNotDirectory: {
    code: 'RMX_TARGET_PATH_NOT_DIRECTORY',
    title: 'Target path is not a directory',
    fix: 'Choose a directory path for the new app target.',
  },
  unexpectedExtraArgument: {
    code: 'RMX_UNEXPECTED_ARGUMENT',
    title: 'Unexpected extra argument',
    fix: 'Remove the extra argument or run the command with --help.',
  },
  unknownArgument: {
    code: 'RMX_UNKNOWN_ARGUMENT',
    title: 'Unknown argument',
    fix: 'Run the command with --help to see supported arguments.',
  },
  unknownCommand: {
    code: 'RMX_UNKNOWN_COMMAND',
    title: 'Unknown command',
    fix: 'Run `remix help` to see available commands.',
  },
  unknownCompletionShell: {
    code: 'RMX_UNKNOWN_COMPLETION_SHELL',
    title: 'Unknown completion shell',
    fix: 'Run `remix completion bash` or `remix completion zsh`.',
  },
  unknownHelpTopic: {
    code: 'RMX_UNKNOWN_HELP_TOPIC',
    title: 'Unknown help topic',
    fix: 'Run `remix help` to see available commands and help topics.',
  },
  unknownSkillsCommand: {
    code: 'RMX_UNKNOWN_SKILLS_COMMAND',
    title: 'Unknown skills command',
    fix: 'Run `remix skills --help` to see available skills commands.',
  },
} satisfies Record<string, CliErrorDefinition>

export class CliError extends Error {
  code: string
  context?: CliErrorContext
  docsUrl?: string
  fix?: string
  showHelp: boolean
  title: string

  constructor(options: CliErrorOptions) {
    super(options.message)
    this.code = options.code
    this.context = options.context
    this.docsUrl = options.docsUrl
    this.fix = options.fix
    this.name = 'CliError'
    this.showHelp = options.showHelp ?? false
    this.title = options.title
  }
}

export class UsageError extends CliError {
  constructor(options: CliErrorOptions) {
    super({ ...options, showHelp: options.showHelp ?? true })
    this.name = 'UsageError'
  }
}

export function appNameUnavailable(targetDir?: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.appNameUnavailable, {
    context: targetDir == null ? undefined : { targetDir },
    message: 'Could not determine an app name from the target directory.',
  })
}

export function remixVersionUnavailable(): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.remixVersionUnavailable, {
    message: 'Could not determine the current Remix version.',
  })
}

export function invalidCompletionRequest(): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.invalidCompletionRequest, {
    message: 'Invalid completion request.',
  })
}

export function fetchUnavailable(): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.fetchUnavailable, {
    message: 'This runtime does not provide fetch().',
  })
}

export function invalidFlagCombination(details: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.invalidFlagCombination, {
    context: { details },
    message: details,
  })
}

export function invalidPackageName(input: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.invalidPackageName, {
    context: { input },
    message: `Could not derive a valid package name from "${input}".`,
  })
}

export function missingOptionValue(option: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.missingOptionValue, {
    context: { option },
    message: `${option} requires a value.`,
  })
}

export function missingTargetDirectory(): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.missingTargetDirectory, {
    message: 'A target directory is required.',
  })
}

export function projectRootNotFound(startDir?: string): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.projectRootNotFound, {
    context: startDir == null ? undefined : { startDir },
    message: 'Could not find a project root. Run this command inside a Remix project.',
  })
}

export function remoteSkillDataMissing(name: string): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.remoteSkillDataMissing, {
    context: { name },
    message: `Could not find remote data for Remix skill: ${name}`,
  })
}

export function routeMapLoaderFailed(details: string): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.routeMapLoaderFailed, {
    context: { details },
    message: details,
  })
}

export function routeMapLoaderInvalidJson(): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.routeMapLoaderInvalidJson, {
    message: 'Route-map loader returned invalid JSON.',
  })
}

export function routeMapLoaderSignal(signal: NodeJS.Signals): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.routeMapLoaderSignal, {
    context: { signal },
    message: `Route-map loader exited from signal ${signal}.`,
  })
}

export function routeOwnerPlanUnresolved(routeName: string): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.routeOwnerPlanUnresolved, {
    context: { routeName },
    message: `Could not resolve owner plan for "${routeName}".`,
  })
}

export function routesFileNotFound(startDir?: string): CliError {
  return createCliError(CLI_ERROR_DEFINITIONS.routesFileNotFound, {
    context: startDir == null ? undefined : { startDir },
    message: 'Could not find app/routes.ts. Run this command inside a Remix app.',
  })
}

export function targetDirectoryNotEmpty(targetDir: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.targetDirectoryNotEmpty, {
    context: { targetDir },
    message: `Target directory is not empty: ${targetDir}. Re-run with --force to continue.`,
  })
}

export function targetPathNotDirectory(targetDir: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.targetPathNotDirectory, {
    context: { targetDir },
    message: `Target path is not a directory: ${targetDir}`,
  })
}

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error
  }

  if (error instanceof Error) {
    return createCliError(CLI_ERROR_DEFINITIONS.internalError, { message: error.message })
  }

  return createCliError(CLI_ERROR_DEFINITIONS.internalError, { message: String(error) })
}

export function unknownArgument(argument: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.unknownArgument, {
    context: { argument },
    message: `Unknown argument: ${argument}`,
  })
}

export function unknownCommand(command: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.unknownCommand, {
    context: { command },
    message: `Unknown command: ${command}`,
  })
}

export function unknownCompletionShell(shell: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.unknownCompletionShell, {
    context: { shell },
    message: `Unknown completion shell: ${shell}`,
  })
}

export function unknownHelpTopic(topic: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.unknownHelpTopic, {
    context: { topic },
    message: `Unknown help topic: ${topic}`,
  })
}

export function unknownSkillsCommand(command: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.unknownSkillsCommand, {
    context: { command },
    message: `Unknown skills command: ${command}`,
  })
}

export function unexpectedExtraArgument(argument: string): UsageError {
  return createUsageError(CLI_ERROR_DEFINITIONS.unexpectedExtraArgument, {
    context: { argument },
    message: `Unexpected extra argument: ${argument}`,
  })
}

export function renderCliError(error: unknown, options: { helpText?: string } = {}): string {
  let cliError = toCliError(error)
  let lines = [`Error [${cliError.code}] ${cliError.title}`, cliError.message]

  if (cliError.fix != null && cliError.fix.length > 0) {
    lines.push('', 'Try:', `  ${cliError.fix}`)
  }

  if (cliError.docsUrl != null && cliError.docsUrl.length > 0) {
    lines.push('', 'Documentation:', `  ${cliError.docsUrl}`)
  }

  let output = `${lines.join('\n')}\n`

  if (cliError.showHelp && options.helpText != null) {
    output += `\n${options.helpText}`
  }

  return output
}

function createCliError(definition: CliErrorDefinition, options: CreateErrorOptions): CliError {
  return new CliError({
    code: definition.code,
    context: options.context,
    docsUrl: definition.docsUrl,
    fix: definition.fix,
    message: options.message,
    title: definition.title,
  })
}

function createUsageError(definition: CliErrorDefinition, options: CreateErrorOptions): UsageError {
  return new UsageError({
    code: definition.code,
    context: options.context,
    docsUrl: definition.docsUrl,
    fix: definition.fix,
    message: options.message,
    title: definition.title,
  })
}
