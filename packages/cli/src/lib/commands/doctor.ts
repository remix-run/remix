import * as path from 'node:path'
import * as process from 'node:process'

import { checkControllerConventions } from '../doctor/controllers.ts'
import type { CliContext } from '../cli-context.ts'
import { checkEnvironment, getEnvironmentFixPlans } from '../doctor/environment.ts'
import { applyDoctorFixPlans } from '../doctor/fixes.ts'
import { checkProject, getProjectFixPlans } from '../doctor/project.ts'
import {
  createDoctorSuite,
  createSkippedDoctorSuite,
  type DoctorAppliedFix,
  type DoctorFinding,
  type DoctorReport,
  type DoctorSuiteName,
  type DoctorSuiteResult,
} from '../doctor/types.ts'
import { renderCliError, toCliError } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'
import {
  createCommandReporter,
  createStepProgressReporter,
  type CommandReporter,
  type StepProgressReporter,
} from '../reporter.ts'

const DOCTOR_SUITE_LABELS = {
  actions: {
    complete: 'actions',
    running: 'Checking actions',
  },
  environment: {
    complete: 'environment',
    running: 'Checking environment',
  },
  project: {
    complete: 'project',
    running: 'Checking project',
  },
} satisfies Record<DoctorSuiteName, string | { complete: string; running: string }>

interface DoctorCommandOptions {
  fix: boolean
  json: boolean
  strict: boolean
}

export async function runDoctorCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDoctorCommandHelpText())
    return 0
  }

  let reporter: CommandReporter | null = null
  let progress: StepProgressReporter<DoctorSuiteName> | null = null

  try {
    let options = parseDoctorCommandArgs(argv)
    reporter = options.json
      ? null
      : createCommandReporter({
          remixVersion: context.remixVersion,
          stderr: process.stdout,
          stdout: process.stdout,
        })
    progress = reporter == null ? null : createDoctorProgressReporter(reporter)
    if (reporter != null) {
      await reporter.status.commandHeader('doctor')
    }

    let report = await collectDoctorReport(progress, options, reporter, context)

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else if (reporter != null) {
      writeDoctorReport(reporter, report)
      reporter.finish()
    }

    if ((options.fix || options.strict) && hasWarningFindings(report.findings)) {
      return 1
    }

    return 0
  } catch (error) {
    progress?.writeSummaryGap()
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getDoctorCommandHelpText(process.stderr) }),
    )
    reporter?.finish()
    return 1
  }
}

export function getDoctorCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'Check project environment and Remix app conventions for the current project.',
      examples: [
        'remix doctor',
        'remix doctor --json',
        'remix doctor --strict',
        'remix doctor --fix',
      ],
      options: [
        { description: 'Print doctor findings as JSON', label: '--json' },
        {
          description: 'Exit with status 1 when warning-level findings are present',
          label: '--strict',
        },
        { description: 'Apply low-risk project and action fixes', label: '--fix' },
      ],
      usage: ['remix doctor [--json] [--strict] [--fix] [--no-color]'],
    },
    target,
  )
}

function parseDoctorCommandArgs(argv: string[]): DoctorCommandOptions {
  let parsed = parseArgs(
    argv,
    {
      fix: { flag: '--fix', type: 'boolean' },
      json: { flag: '--json', type: 'boolean' },
      strict: { flag: '--strict', type: 'boolean' },
    },
    { maxPositionals: 0 },
  )

  return {
    fix: parsed.options.fix,
    json: parsed.options.json,
    strict: parsed.options.strict,
  }
}

async function collectDoctorReport(
  progress: StepProgressReporter<DoctorSuiteName> | null,
  options: DoctorCommandOptions,
  reporter: CommandReporter | null,
  context: CliContext,
): Promise<DoctorReport> {
  let cwd = context.cwd
  let appliedFixes: DoctorAppliedFix[] = []
  let environment = await runDoctorSuite(progress, 'environment', async () => {
    let result = await checkEnvironment(cwd)
    let suiteAppliedFixes: DoctorAppliedFix[] = []
    let finalResult = result

    if (options.fix && result.projectRoot != null) {
      let fixPlans = getEnvironmentFixPlans(result, context.remixVersion)
      if (fixPlans.length > 0) {
        suiteAppliedFixes = await applyDoctorFixPlans(result.projectRoot, fixPlans)
        finalResult = await checkEnvironment(result.projectRoot)
      }
    }

    let suite = finalResult.suite
    if (suiteAppliedFixes.length > 0) {
      suite = {
        ...suite,
        appliedFixes: suiteAppliedFixes,
      }
    }

    return {
      appliedFixes: suiteAppliedFixes,
      projectRoot: finalResult.projectRoot ?? result.projectRoot,
      suite,
    }
  })
  let findings = [...environment.suite.findings]
  appliedFixes.push(...(environment.appliedFixes ?? []))
  let suites: DoctorSuiteResult[] = [environment.suite]
  let routesFile =
    environment.projectRoot == null
      ? undefined
      : path.join(environment.projectRoot, 'app', 'routes.ts')
  writeDoctorSuiteDetails(reporter, environment.suite)
  progress?.writeSummaryGap()

  if (hasWarningFindings(environment.suite.findings)) {
    let projectSuite = createSkippedDoctorSuite('project', 'Blocked by environment warnings.')
    let actionsSuite = createSkippedDoctorSuite('actions', 'Blocked by environment warnings.')
    suites.push(projectSuite, actionsSuite)
    progress?.skip(projectSuite.name, projectSuite.reason)
    writeDoctorSuiteDetails(reporter, projectSuite)
    progress?.writeSummaryGap()
    progress?.skip(actionsSuite.name, actionsSuite.reason)
    writeDoctorSuiteDetails(reporter, actionsSuite)
    progress?.writeSummaryGap()

    return {
      appRoot: environment.projectRoot,
      appliedFixes,
      findings,
      remainingFindings: findings,
      routesFile,
      suites,
    }
  }

  let project = await runDoctorSuite(progress, 'project', async () => {
    let result = await checkProject(environment.projectRoot!)
    let suiteAppliedFixes: DoctorAppliedFix[] = []
    let finalResult = result

    if (options.fix) {
      let fixPlans = await getProjectFixPlans(environment.projectRoot!)
      if (fixPlans.length > 0) {
        suiteAppliedFixes = await applyDoctorFixPlans(environment.projectRoot!, fixPlans)
        finalResult = await checkProject(environment.projectRoot!)
      }
    }

    let suite = finalResult.suite
    if (suiteAppliedFixes.length > 0) {
      suite = {
        ...suite,
        appliedFixes: suiteAppliedFixes,
      }
    }

    return {
      appliedFixes: suiteAppliedFixes,
      routeManifest: finalResult.routeManifest,
      routesFile: finalResult.routesFile,
      suite,
    }
  })
  findings.push(...project.suite.findings)
  appliedFixes.push(...(project.appliedFixes ?? []))
  routesFile = project.routesFile
  suites.push(project.suite)
  writeDoctorSuiteDetails(reporter, project.suite)
  progress?.writeSummaryGap()

  if (hasWarningFindings(project.suite.findings)) {
    let actionsSuite = createSkippedDoctorSuite('actions', 'Blocked by project warnings.')
    suites.push(actionsSuite)
    progress?.skip(actionsSuite.name, actionsSuite.reason)
    writeDoctorSuiteDetails(reporter, actionsSuite)
    progress?.writeSummaryGap()

    return {
      appRoot: environment.projectRoot,
      appliedFixes,
      findings,
      remainingFindings: findings,
      routesFile,
      suites,
    }
  }

  let actions = await runDoctorSuite(progress, 'actions', async () => {
    let controllerResult = await checkControllerConventions(
      project.routeManifest!.appRoot,
      project.routeManifest!.tree,
    )
    let remainingFindings = controllerResult.suite.findings
    let suiteAppliedFixes: DoctorAppliedFix[] = []

    if (options.fix && controllerResult.fixPlans.length > 0) {
      suiteAppliedFixes = await applyDoctorFixPlans(
        project.routeManifest!.appRoot,
        controllerResult.fixPlans,
      )
      let finalControllerResult = await checkControllerConventions(
        project.routeManifest!.appRoot,
        project.routeManifest!.tree,
      )
      remainingFindings = finalControllerResult.suite.findings
    }

    let suite = createDoctorSuite('actions', remainingFindings)
    if (suiteAppliedFixes.length > 0) {
      suite.appliedFixes = suiteAppliedFixes
    }

    return { appliedFixes: suiteAppliedFixes, suite }
  })

  findings.push(...actions.suite.findings)
  appliedFixes.push(...(actions.appliedFixes ?? []))
  suites.push(actions.suite)
  writeDoctorSuiteDetails(reporter, actions.suite)
  progress?.writeSummaryGap()

  let report: DoctorReport = {
    appRoot: environment.projectRoot,
    findings,
    routesFile,
    suites,
  }

  if (options.fix) {
    report.appliedFixes = appliedFixes
    report.remainingFindings = findings
  }

  return report
}

function hasWarningFindings(findings: DoctorFinding[]): boolean {
  return findings.some((finding) => finding.severity === 'warn')
}

function formatAppliedFix(appliedFix: DoctorAppliedFix): string {
  if (appliedFix.kind === 'update-file') {
    return `Updated ${appliedFix.path}`
  }

  return `Created ${appliedFix.path}`
}

async function runDoctorSuite<
  result extends { appliedFixes?: DoctorAppliedFix[]; suite: DoctorSuiteResult },
>(
  progress: StepProgressReporter<DoctorSuiteName> | null,
  label: DoctorSuiteName,
  callback: () => Promise<result>,
): Promise<result> {
  progress?.start(label)

  try {
    let result = await callback()

    if (result.suite.status === 'ok') {
      progress?.succeed(label)
    } else if (result.suite.status === 'issues') {
      progress?.fail(label)
    } else {
      progress?.skip(label, result.suite.reason)
    }

    return result
  } catch (error) {
    progress?.fail(label)
    throw error
  }
}

function createDoctorProgressReporter(
  reporter: CommandReporter,
): StepProgressReporter<DoctorSuiteName> {
  return createStepProgressReporter(reporter.status, DOCTOR_SUITE_LABELS)
}

function writeDoctorReport(reporter: CommandReporter, report: DoctorReport): void {
  let warningCount = report.findings.filter((finding) => finding.severity === 'warn').length
  let adviceCount = report.findings.length - warningCount

  if ((report.appliedFixes?.length ?? 0) > 0) {
    let fixCount = report.appliedFixes!.length
    reporter.out.line(`Applied ${fixCount} ${fixCount === 1 ? 'fix' : 'fixes'}.`)
  }

  if (report.findings.length === 0) {
    reporter.out.line('Doctor found no issues.')
  }

  reporter.out.line(`Summary: ${warningCount} warnings, ${adviceCount} advice.`)
}

function writeDoctorSuiteDetails(reporter: CommandReporter | null, suite: DoctorSuiteResult): void {
  if (reporter == null) {
    return
  }

  if (suite.findings.length === 0 && (suite.appliedFixes?.length ?? 0) === 0) {
    return
  }

  reporter.out.withIndent(() => {
    for (let finding of suite.findings) {
      reporter.out.bullet(
        reporter.out.label(finding.severity.toUpperCase(), finding.message, {
          tone: finding.severity === 'warn' ? 'warn' : undefined,
        }),
      )
    }

    if ((suite.appliedFixes?.length ?? 0) > 0) {
      reporter.out.section('Applied fixes:', () => {
        reporter.out.bullets((suite.appliedFixes ?? []).map(formatAppliedFix))
      })
    }
  })
}
