import * as path from 'node:path'
import * as process from 'node:process'

import { checkControllerConventions } from '../doctor/controllers.ts'
import { checkEnvironment } from '../doctor/environment.ts'
import { applyDoctorFixPlans } from '../doctor/fixes.ts'
import { checkProject } from '../doctor/project.ts'
import {
  createDoctorSuite,
  createSkippedDoctorSuite,
  type DoctorAppliedFix,
  type DoctorFinding,
  type DoctorFixPlan,
  type DoctorReport,
  type DoctorSuiteName,
  type DoctorSuiteResult,
} from '../doctor/types.ts'
import { renderCliError, toCliError, unknownArgument, unexpectedExtraArgument } from '../errors.ts'
import {
  createStepProgressReporter,
  type StepProgressReporter,
  writeProgressCommandHeader,
} from '../progress.ts'
import { lightRed, lightYellow } from '../terminal.ts'

const DOCTOR_SUITE_LABELS = {
  controllers: {
    complete: 'controllers',
    running: 'Checking controllers',
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

export async function runDoctorCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDoctorCommandHelpText())
    return 0
  }

  let progress: StepProgressReporter<DoctorSuiteName> | null = null

  try {
    let options = parseDoctorCommandArgs(argv)
    progress = options.json ? null : createStepProgressReporter(DOCTOR_SUITE_LABELS, process.stdout)
    if (!options.json) {
      await writeProgressCommandHeader('doctor', process.stdout)
    }

    let report = await collectDoctorReport(progress, options)

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else {
      process.stdout.write(renderDoctorSummary(report))
    }

    if ((options.fix || options.strict) && hasWarningFindings(report.findings)) {
      return 1
    }

    return 0
  } catch (error) {
    let cliError = toCliError(error)
    progress?.writeSummaryGap()
    process.stderr.write(
      lightRed(renderCliError(cliError, { helpText: getDoctorCommandHelpText() }), process.stderr),
    )
    return 1
  }
}

export function getDoctorCommandHelpText(): string {
  return `Usage:
  remix doctor [--json] [--strict] [--fix] [--no-color]

Check project environment and Remix app conventions for the current project.

Options:
  --json       Print doctor findings as JSON
  --strict     Exit with status 1 when warning-level findings are present
  --fix        Create missing low-risk controller owner files

Examples:
  remix doctor
  remix doctor --json
  remix doctor --strict
  remix doctor --fix
`
}

function parseDoctorCommandArgs(argv: string[]): DoctorCommandOptions {
  let fix = false
  let json = false
  let strict = false

  for (let arg of argv) {
    if (arg === '--json') {
      json = true
      continue
    }

    if (arg === '--strict') {
      strict = true
      continue
    }

    if (arg === '--fix') {
      fix = true
      continue
    }

    if (arg.startsWith('-')) {
      throw unknownArgument(arg)
    }

    throw unexpectedExtraArgument(arg)
  }

  return { fix, json, strict }
}

async function collectDoctorReport(
  progress: StepProgressReporter<DoctorSuiteName> | null,
  options: DoctorCommandOptions,
): Promise<DoctorReport> {
  let appliedFixes: DoctorAppliedFix[] = []
  let environment = await runDoctorSuite(progress, 'environment', () => checkEnvironment())
  let findings = [...environment.suite.findings]
  let suites: DoctorSuiteResult[] = [environment.suite]
  let routesFile =
    environment.projectRoot == null
      ? undefined
      : path.join(environment.projectRoot, 'app', 'routes.ts')

  if (progress != null) {
    writeSuiteFindings(environment.suite)
    writeSuiteAppliedFixes(environment.suite)
    writeSuiteGap(progress)
  }

  if (hasWarningFindings(environment.suite.findings)) {
    let projectSuite = createSkippedDoctorSuite('project', 'Blocked by environment warnings.')
    let controllersSuite = createSkippedDoctorSuite(
      'controllers',
      'Blocked by environment warnings.',
    )
    suites.push(projectSuite, controllersSuite)
    progress?.skip(projectSuite.name, projectSuite.reason)
    writeSuiteGap(progress)
    progress?.skip(controllersSuite.name, controllersSuite.reason)
    writeSuiteGap(progress)

    return {
      appRoot: environment.projectRoot,
      appliedFixes,
      findings,
      remainingFindings: findings,
      routesFile,
      suites,
    }
  }

  let project = await runDoctorSuite(progress, 'project', () => checkProject(environment.projectRoot!))
  findings.push(...project.suite.findings)
  routesFile = project.routesFile
  suites.push(project.suite)

  if (progress != null) {
    writeSuiteFindings(project.suite)
    writeSuiteAppliedFixes(project.suite)
    writeSuiteGap(progress)
  }

  if (hasWarningFindings(project.suite.findings)) {
    let controllersSuite = createSkippedDoctorSuite('controllers', 'Blocked by project warnings.')
    suites.push(controllersSuite)
    progress?.skip(controllersSuite.name, controllersSuite.reason)
    writeSuiteGap(progress)

    return {
      appRoot: environment.projectRoot,
      appliedFixes,
      findings,
      remainingFindings: findings,
      routesFile,
      suites,
    }
  }

  let controllers = await runDoctorSuite(progress, 'controllers', async () => {
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
      remainingFindings = getRemainingFindings(controllerResult.suite.findings, suiteAppliedFixes)
    }

    let suite = createDoctorSuite('controllers', remainingFindings)
    if (suiteAppliedFixes.length > 0) {
      suite.appliedFixes = suiteAppliedFixes
    }

    return { appliedFixes: suiteAppliedFixes, suite }
  })

  findings.push(...controllers.suite.findings)
  appliedFixes.push(...(controllers.appliedFixes ?? []))
  suites.push(controllers.suite)

  if (progress != null) {
    writeSuiteFindings(controllers.suite)
    writeSuiteAppliedFixes(controllers.suite)
    writeSuiteGap(progress)
  }

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

function getRemainingFindings(
  findings: DoctorFinding[],
  appliedFixes: DoctorAppliedFix[],
): DoctorFinding[] {
  let appliedFindingKeys = new Set(
    appliedFixes.map((appliedFix) => `${appliedFix.code}:${appliedFix.routeName ?? ''}`),
  )

  return findings.filter(
    (finding) => !appliedFindingKeys.has(`${finding.code}:${finding.routeName ?? ''}`),
  )
}

function renderDoctorSummary(report: DoctorReport): string {
  let lines: string[] = []
  let warningCount = report.findings.filter((finding) => finding.severity === 'warn').length
  let adviceCount = report.findings.length - warningCount

  if ((report.appliedFixes?.length ?? 0) > 0) {
    let fixCount = report.appliedFixes!.length
    lines.push(`Applied ${fixCount} ${fixCount === 1 ? 'fix' : 'fixes'}.`)
  }

  if (report.findings.length === 0) {
    lines.push('Doctor found no issues.')
  }

  lines.push(`Summary: ${warningCount} warnings, ${adviceCount} advice.`)

  return `${lines.join('\n')}\n`
}

function hasWarningFindings(findings: DoctorFinding[]): boolean {
  return findings.some((finding) => finding.severity === 'warn')
}

function formatFinding(finding: DoctorFinding): string {
  let line = `  • [${finding.severity.toUpperCase()}] ${finding.message}`

  if (finding.severity === 'warn') {
    return lightYellow(line)
  }

  return line
}

function formatAppliedFix(appliedFix: DoctorAppliedFix): string {
  if (appliedFix.kind === 'create-file') {
    return `  • Created ${appliedFix.path}`
  }

  return `  • Created ${appliedFix.path}`
}

function writeSuiteGap(progress: StepProgressReporter<DoctorSuiteName> | null): void {
  if (progress == null) {
    return
  }

  process.stdout.write('\n')
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

function writeSuiteFindings(suite: DoctorSuiteResult): void {
  if (suite.status !== 'issues') {
    return
  }

  for (let finding of suite.findings) {
    process.stdout.write(`${formatFinding(finding)}\n`)
  }
}

function writeSuiteAppliedFixes(suite: DoctorSuiteResult): void {
  if ((suite.appliedFixes?.length ?? 0) === 0) {
    return
  }

  process.stdout.write('  Applied fixes:\n')

  for (let appliedFix of suite.appliedFixes ?? []) {
    process.stdout.write(`${formatAppliedFix(appliedFix)}\n`)
  }
}
