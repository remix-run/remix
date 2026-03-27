import * as process from 'node:process'

import { lightRed, lightYellow } from '../color.ts'
import {
  checkControllerConventions,
  type DoctorFinding,
  type DoctorSuiteResult,
} from '../doctor/controllers.ts'
import { renderCliError, toCliError, unknownArgument, unexpectedExtraArgument } from '../errors.ts'
import { loadRouteManifest } from '../route-map.ts'

export async function runDoctorCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDoctorCommandHelpText())
    return 0
  }

  try {
    let options = parseDoctorCommandArgs(argv)
    let routeManifest = await loadRouteManifest()
    let suite = await checkControllerConventions(routeManifest.appRoot, routeManifest.tree)
    let findings = suite.findings
    let report = {
      appRoot: routeManifest.appRoot,
      findings,
      routesFile: routeManifest.routesFile,
      suites: [suite],
    }

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else {
      process.stdout.write(renderDoctorReport(suite))
    }

    if (options.strict && hasWarningFindings(findings)) {
      return 1
    }

    return 0
  } catch (error) {
    let cliError = toCliError(error)
    process.stderr.write(lightRed(renderCliError(cliError, { helpText: getDoctorCommandHelpText() }), process.stderr))
    return 1
  }
}

export function getDoctorCommandHelpText(): string {
  return `Usage:
  remix doctor [--json] [--strict] [--no-color]

Check Remix controller-directory conventions for the current project.

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

function renderDoctorReport(suite: DoctorSuiteResult): string {
  let lines: string[] = [suite.name]
  let warningCount = suite.findings.filter((finding) => finding.severity === 'warn').length
  let adviceCount = suite.findings.length - warningCount

  if (suite.findings.length === 0) {
    lines.push('  No findings.')
    lines.push('')
    lines.push('Doctor found no issues.')
    lines.push('Summary: 0 warnings, 0 advice.')
    return `${lines.join('\n')}\n`
  }

  for (let finding of suite.findings) {
    lines.push(formatFinding(finding))
  }

  lines.push('')
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
