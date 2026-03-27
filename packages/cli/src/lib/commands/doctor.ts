import * as path from 'node:path'
import * as process from 'node:process'

import { checkControllerConventions } from '../doctor/controllers.ts'
import { checkEnvironment } from '../doctor/environment.ts'
import { checkProjectContract } from '../doctor/project-contract.ts'
import {
  createSkippedDoctorSuite,
  type DoctorFinding,
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
    let report = await collectDoctorReport(progress)

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else {
      process.stdout.write(renderDoctorSummary(report))
    }

    if (options.strict && hasWarningFindings(report.findings)) {
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
  remix doctor [--json] [--strict] [--no-color]

Check project environment and Remix app conventions for the current project.

Options:
  --json       Print doctor findings as JSON
  --strict     Exit with status 1 when warning-level findings are present

Examples:
  remix doctor
  remix doctor --json
  remix doctor --strict
`
}

function parseDoctorCommandArgs(argv: string[]): { json: boolean; strict: boolean } {
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

    if (arg.startsWith('-')) {
      throw unknownArgument(arg)
    }

    throw unexpectedExtraArgument(arg)
  }

  return { json, strict }
}

async function collectDoctorReport(
  progress: StepProgressReporter<DoctorSuiteName> | null,
): Promise<DoctorReport> {
  let environment = await runDoctorSuite(progress, 'environment', () => checkEnvironment())
  let findings = [...environment.suite.findings]
  let suites: DoctorSuiteResult[] = [environment.suite]
  let routesFile =
    environment.projectRoot == null
      ? undefined
      : path.join(environment.projectRoot, 'app', 'routes.ts')

  if (progress != null) {
    writeSuiteFindings(environment.suite)
    writeSuiteGap(progress)
  }

  if (hasWarningFindings(environment.suite.findings)) {
    let projectContractSuite = createSkippedDoctorSuite(
      'project',
      'Blocked by environment warnings.',
    )
    let controllersSuite = createSkippedDoctorSuite(
      'controllers',
      'Blocked by environment warnings.',
    )
    suites.push(projectContractSuite, controllersSuite)
    progress?.skip(projectContractSuite.name, projectContractSuite.reason)
    writeSuiteGap(progress)
    progress?.skip(controllersSuite.name, controllersSuite.reason)
    writeSuiteGap(progress)

    return {
      appRoot: environment.projectRoot,
      findings,
      routesFile,
      suites,
    }
  }

  let projectContract = await runDoctorSuite(progress, 'project', () =>
    checkProjectContract(environment.projectRoot!),
  )
  findings.push(...projectContract.suite.findings)
  routesFile = projectContract.routesFile
  suites.push(projectContract.suite)

  if (progress != null) {
    writeSuiteFindings(projectContract.suite)
    writeSuiteGap(progress)
  }

  if (hasWarningFindings(projectContract.suite.findings)) {
    let controllersSuite = createSkippedDoctorSuite('controllers', 'Blocked by project warnings.')
    suites.push(controllersSuite)
    progress?.skip(controllersSuite.name, controllersSuite.reason)
    writeSuiteGap(progress)

    return {
      appRoot: environment.projectRoot,
      findings,
      routesFile,
      suites,
    }
  }

  let controllers = await runDoctorSuite(progress, 'controllers', async () => ({
    suite: await checkControllerConventions(
      projectContract.routeManifest!.appRoot,
      projectContract.routeManifest!.tree,
    ),
  }))
  findings.push(...controllers.suite.findings)
  suites.push(controllers.suite)

  if (progress != null) {
    writeSuiteFindings(controllers.suite)
    writeSuiteGap(progress)
  }

  return {
    appRoot: environment.projectRoot,
    findings,
    routesFile,
    suites,
  }
}

function renderDoctorSummary(report: DoctorReport): string {
  let lines: string[] = []
  let warningCount = report.findings.filter((finding) => finding.severity === 'warn').length
  let adviceCount = report.findings.length - warningCount

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

function writeSuiteGap(progress: StepProgressReporter<DoctorSuiteName> | null): void {
  if (progress == null) {
    return
  }

  process.stdout.write('\n')
}

async function runDoctorSuite<result extends { suite: DoctorSuiteResult }>(
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
