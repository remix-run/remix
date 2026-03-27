import * as process from 'node:process'

import {
  checkControllerConventions,
  type DoctorFinding,
  type DoctorSuiteResult,
} from '../doctor/controllers.ts'
import { UsageError } from '../errors.ts'
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
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n`)
      process.stderr.write(getDoctorCommandHelpText())
      return 1
    }

    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`)
      return 1
    }

    throw error
  }
}

export function getDoctorCommandHelpText(): string {
  return `Usage:
  remix doctor [--json] [--strict]

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
      throw new UsageError(`Unknown argument: ${arg}`)
    }

    throw new UsageError(`Unexpected extra argument: ${arg}`)
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
    lines.push(`  ${finding.severity.toUpperCase()} ${finding.message}`)
  }

  lines.push('')
  lines.push(`Summary: ${warningCount} warnings, ${adviceCount} advice.`)

  return `${lines.join('\n')}\n`
}

function hasWarningFindings(findings: DoctorFinding[]): boolean {
  return findings.some((finding) => finding.severity === 'warn')
}
