import * as process from 'node:process'

import { boldLightBlue, lightYellow } from './terminal.ts'

export interface HelpTextSectionRow {
  description: string
  label: string
}

export interface HelpTextOptions {
  commands?: HelpTextSectionRow[]
  description?: string
  examples?: string[]
  options?: HelpTextSectionRow[]
  usage: string[]
}

const SECTION_INDENT = '  '
const ROW_GAP = 2

export function formatHelpText(
  options: HelpTextOptions,
  target: NodeJS.WriteStream = process.stdout,
): string {
  let sections: string[] = [renderUsageSection(options.usage, target)]

  if (options.description != null && options.description.length > 0) {
    sections.push(options.description)
  }

  if (options.commands != null && options.commands.length > 0) {
    sections.push(renderRowSection('Commands', options.commands, target))
  }

  if (options.options != null && options.options.length > 0) {
    sections.push(renderRowSection('Options', options.options, target))
  }

  if (options.examples != null && options.examples.length > 0) {
    sections.push(renderExamplesSection(options.examples, target))
  }

  return `${sections.join('\n\n')}\n`
}

function renderUsageSection(usage: string[], target: NodeJS.WriteStream): string {
  return renderSection(
    'Usage',
    usage.map((line) => `${SECTION_INDENT}${highlightSyntax(line, target)}`),
    target,
  )
}

function renderExamplesSection(examples: string[], target: NodeJS.WriteStream): string {
  return renderSection(
    'Examples',
    examples.map((line) => `${SECTION_INDENT}${highlightSyntax(line, target)}`),
    target,
  )
}

function renderRowSection(
  title: string,
  rows: HelpTextSectionRow[],
  target: NodeJS.WriteStream,
): string {
  let labelWidth = rows.reduce((width, row) => Math.max(width, row.label.length), 0) + ROW_GAP
  let lines = rows.map((row) => {
    let paddedLabel = row.label.padEnd(labelWidth)
    return `${SECTION_INDENT}${highlightSyntax(paddedLabel, target)}${row.description}`
  })

  return renderSection(title, lines, target)
}

function renderSection(title: string, lines: string[], target: NodeJS.WriteStream): string {
  return `${formatHeading(title, target)}:\n${lines.join('\n')}`
}

function formatHeading(title: string, target: NodeJS.WriteStream): string {
  return boldLightBlue(title, target)
}

function highlightSyntax(text: string, target: NodeJS.WriteStream): string {
  return text.replace(/(--[A-Za-z0-9-]+|-[A-Za-z]|\[[A-Za-z][A-Za-z0-9-]*\]|<[^>\n]+>)/g, (token) =>
    lightYellow(token, target),
  )
}
