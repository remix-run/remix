import * as path from 'node:path'
import * as process from 'node:process'

import { lightRed, lightYellow } from '../color.ts'
import { checkControllerConventions } from '../doctor/controllers.ts'
import { checkEnvironment } from '../doctor/environment.ts'
import { checkProjectContract } from '../doctor/project-contract.ts'
import {
  createSkippedDoctorSuite,
  type DoctorFinding,
  type DoctorReport,
  type DoctorSuiteResult,
} from '../doctor/types.ts'
import { renderCliError, toCliError, unknownArgument, unexpectedExtraArgument } from '../errors.ts'

export async function runDoctorCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDoctorCommandHelpText())
    return 0
  }

  try {
    let options = parseDoctorCommandArgs(argv)
    let environment = await checkEnvironment()
    let findings = [...environment.suite.findings]
    let suites: DoctorSuiteResult[] = [environment.suite]
    let routesFile =
      environment.projectRoot == null
        ? undefined
        : path.join(environment.projectRoot, 'app', 'routes.ts')

    if (hasWarningFindings(environment.suite.findings)) {
      suites.push(createSkippedDoctorSuite('project-contract', 'Blocked by environment warnings.'))
      suites.push(createSkippedDoctorSuite('controllers', 'Blocked by environment warnings.'))
    } else {
      let projectContract = await checkProjectContract(environment.projectRoot!)
      findings.push(...projectContract.suite.findings)
      routesFile = projectContract.routesFile
      suites.push(projectContract.suite)

      if (hasWarningFindings(projectContract.suite.findings)) {
        suites.push(
          createSkippedDoctorSuite('controllers', 'Blocked by project-contract warnings.'),
        )
      } else {
        let controllers = await checkControllerConventions(
          projectContract.routeManifest!.appRoot,
          projectContract.routeManifest!.tree,
        )
        findings.push(...controllers.findings)
        suites.push(controllers)
      }
    }

    let report: DoctorReport = {
      appRoot: environment.projectRoot,
      findings,
      routesFile,
      suites,
    }

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else {
      process.stdout.write(renderDoctorReport(report))
    }

    if (options.strict && hasWarningFindings(findings)) {
      return 1
    }

    return 0
  } catch (error) {
    let cliError = toCliError(error)
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

function renderDoctorReport(report: DoctorReport): string {
  let lines: string[] = []
  let warningCount = report.findings.filter((finding) => finding.severity === 'warn').length
  let adviceCount = report.findings.length - warningCount

  for (let [index, suite] of report.suites.entries()) {
    if (index > 0) {
      lines.push('')
    }

    lines.push(suite.name)

    if (suite.status === 'skipped') {
      lines.push(`  Skipped: ${suite.reason ?? 'This suite did not run.'}`)
      continue
    }

    if (suite.findings.length === 0) {
      lines.push('  No findings.')
      continue
    }

    for (let finding of suite.findings) {
      lines.push(formatFinding(finding))
    }
  }

  lines.push('')

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
  let line = `  ${finding.severity.toUpperCase()} ${finding.message}`

  if (finding.severity === 'warn') {
    return lightYellow(line)
  }

  return line
}
