import * as process from 'node:process'

import { readRemixVersion } from './remix-version.ts'
import {
  bold,
  canUseAnsi,
  clearCurrentLine,
  lightGray,
  lightGreen,
  lightRed,
  lightYellow,
  remixWordmark,
} from './terminal.ts'

const BULLET = '•'
const DOT_FRAMES = ['.', '..', '...'] as const
const DEFAULT_INDENT = '  '
const DEFAULT_STATUS_FRAME_INTERVAL_MS = 250

interface StepProgressLabel {
  complete: string
  running?: string
}

export interface CommandReporter {
  finish(): void
  out: TextChannel
  status: StatusChannel
}

export interface TableOptions {
  headers: string[]
  noHeaders?: boolean
  rows: string[][]
  formatRow?: (line: string, rowIndex: number) => string
}

export interface TextChannel {
  blank(): void
  bullet(text: string): void
  bullets(items: string[]): void
  dedent(): void
  indent(): void
  label(tag: string, text: string, options?: LabelOptions): string
  line(text?: string): void
  section(title: string, callback?: () => void): void
  table(options: TableOptions): void
  withIndent<result>(callback: () => result): result
}

export interface StatusChannel extends TextChannel {
  commandHeader(commandLabel: string): Promise<void>
  failStep(label?: string): void
  skipStep(label: string, reason?: string): void
  startStep(label: string): void
  succeedStep(label?: string): void
  summaryGap(): void
}

export interface LabelOptions {
  tone?: 'error' | 'warn'
}

export interface CreateCommandReporterOptions {
  stderr?: NodeJS.WriteStream
  statusFrameIntervalMs?: number
  stdout?: NodeJS.WriteStream
}

export interface StepProgressReporter<step extends string> {
  fail(step: step): void
  skip(step: step, reason?: string): void
  start(step: step): void
  succeed(step: step): void
  writeSummaryGap(): void
}

export function createCommandReporter(options: CreateCommandReporterOptions = {}): CommandReporter {
  let stdout = options.stdout ?? process.stdout
  let stderr = options.stderr ?? process.stderr
  let session = new ReporterSessionState()
  let states = new Map<NodeJS.WriteStream, ReporterStreamState>()
  let getState = (stream: NodeJS.WriteStream) => {
    let state = states.get(stream)
    if (state != null) {
      return state
    }

    state = new ReporterStreamState(stream, session)
    states.set(stream, state)
    return state
  }

  return {
    finish() {
      for (let state of states.values()) {
        state.finish()
      }
    },
    out: new ReporterTextChannel(stdout, getState(stdout)),
    status: new ReporterStatusChannel(
      stderr,
      getState(stderr),
      options.statusFrameIntervalMs ?? DEFAULT_STATUS_FRAME_INTERVAL_MS,
    ),
  }
}

export function createStepProgressReporter<step extends string>(
  status: StatusChannel,
  labels: Record<step, string | StepProgressLabel>,
): StepProgressReporter<step> {
  return {
    fail(step) {
      status.failStep(getCompleteLabel(labels[step]))
    },
    skip(step, reason) {
      status.skipStep(getCompleteLabel(labels[step]), reason)
    },
    start(step) {
      status.startStep(getRunningLabel(labels[step]))
    },
    succeed(step) {
      status.succeedStep(getCompleteLabel(labels[step]))
    },
    writeSummaryGap() {
      status.summaryGap()
    },
  }
}

export async function runProgressStep<step extends string, result>(
  progress: StepProgressReporter<step> | null | undefined,
  step: step,
  callback: () => Promise<result>,
): Promise<result> {
  progress?.start(step)

  try {
    let result = await callback()
    progress?.succeed(step)
    return result
  } catch (error) {
    progress?.fail(step)
    throw error
  }
}

class ReporterTextChannel implements TextChannel {
  #indentLevel = 0
  #state: ReporterStreamState
  #stream: NodeJS.WriteStream

  constructor(stream: NodeJS.WriteStream, state: ReporterStreamState) {
    this.#stream = stream
    this.#state = state
  }

  blank(): void {
    if (!this.#state.hasWrittenContent()) {
      return
    }

    this.#state.queueBlank()
  }

  bullet(text: string): void {
    this.line(`${BULLET} ${text}`)
  }

  bullets(items: string[]): void {
    for (let item of items) {
      this.bullet(item)
    }
  }

  dedent(): void {
    this.#indentLevel = Math.max(0, this.#indentLevel - 1)
  }

  indent(): void {
    this.#indentLevel += 1
  }

  label(tag: string, text: string, options?: LabelOptions): string {
    let line = text.length === 0 ? formatLabel(tag) : `${formatLabel(tag)} ${text}`

    if (options?.tone === 'warn') {
      return lightYellow(line, this.#stream)
    }

    if (options?.tone === 'error') {
      return lightRed(line, this.#stream)
    }

    return line
  }

  line(text = ''): void {
    if (text.length === 0) {
      this.blank()
      return
    }

    this.#flushPendingBlank()
    this.#write(`${this.#getIndent()}${text}\n`)
  }

  section(title: string, callback?: () => void): void {
    this.line(title)
    if (callback == null) {
      return
    }

    this.withIndent(callback)
  }

  table({ formatRow, headers, noHeaders = false, rows }: TableOptions): void {
    let columnCount = Math.max(headers.length, ...rows.map((row) => row.length))
    let widths = Array.from({ length: columnCount }, (_, columnIndex) => {
      let headerWidth = headers[columnIndex]?.length ?? 0
      let rowWidth = rows.reduce((width, row) => Math.max(width, row[columnIndex]?.length ?? 0), 0)
      return Math.max(headerWidth, rowWidth)
    })

    if (!noHeaders) {
      this.line(
        headers
          .map((header, columnIndex) =>
            bold(header.padEnd(widths[columnIndex] ?? header.length), this.#stream),
          )
          .join('  '),
      )
    }

    rows.forEach((row, rowIndex) => {
      let line = row
        .map((cell, columnIndex) => cell.padEnd(widths[columnIndex] ?? cell.length))
        .join('  ')
      this.line(formatRow == null ? line : formatRow(line, rowIndex))
    })
  }

  withIndent<result>(callback: () => result): result {
    this.indent()

    try {
      return callback()
    } finally {
      this.dedent()
    }
  }

  getStream(): NodeJS.WriteStream {
    return this.#stream
  }

  writeImmediate(text: string): void {
    this.#state.writeImmediate(text)
  }

  getIndentText(): string {
    return this.#getIndent()
  }

  #flushPendingBlank(): void {
    this.#state.flushPendingBlank()
  }

  #getIndent(): string {
    return DEFAULT_INDENT.repeat(this.#indentLevel)
  }

  #write(text: string): void {
    this.#state.write(text)
  }
}

class ReporterStatusChannel extends ReporterTextChannel implements StatusChannel {
  #activeLabel: string | null = null
  #activeTimer: NodeJS.Timeout | null = null
  #frameIndex = 0
  #frameIntervalMs: number
  #hasRenderedStep = false
  #hasWrittenSummaryGap = false

  constructor(stream: NodeJS.WriteStream, state: ReporterStreamState, frameIntervalMs: number) {
    super(stream, state)
    this.#frameIntervalMs = frameIntervalMs
  }

  async commandHeader(commandLabel: string): Promise<void> {
    if (!this.getStream().isTTY) {
      return
    }

    try {
      let version = readRemixVersion()
      this.writeImmediate(`${remixWordmark(this.getStream())} v${version} - ${commandLabel}\n\n`)
    } catch {}
  }

  failStep(label = this.#activeLabel ?? ''): void {
    this.#stopAnimation()
    this.#activeLabel = null
    this.#noteStepOutput()
    this.#writeFinalLine(this.#formatFailedLine(label))
  }

  skipStep(label: string, reason?: string): void {
    this.#stopAnimation()
    if (this.#activeLabel === label) {
      this.#activeLabel = null
    }
    this.#noteStepOutput()
    this.#writeFinalLine(this.#formatSkippedLine(label, reason))
  }

  startStep(label: string): void {
    this.#stopAnimation()
    this.#activeLabel = label
    this.#noteStepOutput()

    if (this.#isInteractive()) {
      this.#frameIndex = 0
      this.writeImmediate(this.#renderLiveLine(this.#formatRunningLine(label, DOT_FRAMES[0])))
      this.#activeTimer = setInterval(() => {
        if (this.#activeLabel == null) {
          return
        }

        this.#frameIndex = (this.#frameIndex + 1) % DOT_FRAMES.length
        this.writeImmediate(
          this.#renderLiveLine(
            this.#formatRunningLine(this.#activeLabel, DOT_FRAMES[this.#frameIndex]),
          ),
        )
      }, this.#frameIntervalMs)
      this.#activeTimer.unref?.()
      return
    }

    this.writeImmediate(`${this.#formatRunningLine(label, '...')}\n`)
  }

  succeedStep(label = this.#activeLabel ?? ''): void {
    this.#stopAnimation()
    this.#activeLabel = null
    this.#noteStepOutput()
    this.#writeFinalLine(this.#formatSucceededLine(label))
  }

  summaryGap(): void {
    if (!this.#hasRenderedStep || this.#hasWrittenSummaryGap) {
      return
    }

    this.writeImmediate('\n')
    this.#hasWrittenSummaryGap = true
  }

  #formatFailedLine(label: string): string {
    return `${this.getIndentText()}${lightRed('✗', this.getStream())} ${lightGray(label, this.getStream())}`
  }

  #formatRunningLine(label: string, dots: string): string {
    return lightGray(`${this.getIndentText()}${BULLET} ${label}${dots}`, this.getStream())
  }

  #formatSkippedLine(label: string, reason?: string): string {
    let line = reason == null ? `${BULLET} ${label}` : `${BULLET} ${label} (skipped: ${reason})`
    return lightGray(`${this.getIndentText()}${line}`, this.getStream())
  }

  #formatSucceededLine(label: string): string {
    return `${this.getIndentText()}${lightGreen('✓', this.getStream())} ${lightGray(label, this.getStream())}`
  }

  #isInteractive(): boolean {
    return canUseAnsi(this.getStream())
  }

  #noteStepOutput(): void {
    this.#hasRenderedStep = true
    this.#hasWrittenSummaryGap = false
  }

  #renderLiveLine(line: string): string {
    return `${clearCurrentLine()}${line}`
  }

  #stopAnimation(): void {
    if (this.#activeTimer != null) {
      clearInterval(this.#activeTimer)
      this.#activeTimer = null
    }
  }

  #writeFinalLine(line: string): void {
    if (this.#isInteractive()) {
      this.writeImmediate(`${this.#renderLiveLine(line)}\n`)
      return
    }

    this.writeImmediate(`${line}\n`)
  }
}

class ReporterStreamState {
  #hasWrittenContent = false
  #pendingBlank = false
  #session: ReporterSessionState
  #stream: NodeJS.WriteStream
  #trailingNewlineCount = 0

  constructor(stream: NodeJS.WriteStream, session: ReporterSessionState) {
    this.#session = session
    this.#stream = stream
  }

  finish(): void {
    if (!this.#hasWrittenContent) {
      return
    }

    if (this.#trailingNewlineCount >= 2) {
      return
    }

    this.#writeRaw('\n')
    this.#pendingBlank = false
  }

  flushPendingBlank(): void {
    if (!this.#pendingBlank) {
      return
    }

    this.#writeRaw('\n')
    this.#pendingBlank = false
  }

  hasWrittenContent(): boolean {
    return this.#hasWrittenContent
  }

  queueBlank(): void {
    this.#pendingBlank = true
  }

  write(text: string): void {
    if (!this.#session.hasWrittenPreamble()) {
      this.#writeRaw('\n')
      this.#session.markPreambleWritten()
    }

    this.#writeRaw(text)
    this.#hasWrittenContent = true
  }

  writeImmediate(text: string): void {
    if (!this.#session.hasWrittenPreamble()) {
      this.#writeRaw('\n')
      this.#session.markPreambleWritten()
    }

    this.#writeRaw(text)
    this.#hasWrittenContent = true
    this.#pendingBlank = false
  }

  #writeRaw(text: string): void {
    this.#stream.write(text)
    this.#updateTrailingNewlines(text)
  }

  #updateTrailingNewlines(text: string): void {
    let trailingNewlines = 0

    for (let index = text.length - 1; index >= 0; index--) {
      if (text[index] !== '\n') {
        break
      }

      trailingNewlines += 1
    }

    if (trailingNewlines === 0) {
      this.#trailingNewlineCount = 0
      return
    }

    if (trailingNewlines === text.length) {
      this.#trailingNewlineCount += trailingNewlines
      return
    }

    this.#trailingNewlineCount = trailingNewlines
  }
}

class ReporterSessionState {
  #hasWrittenPreamble = false

  hasWrittenPreamble(): boolean {
    return this.#hasWrittenPreamble
  }

  markPreambleWritten(): void {
    this.#hasWrittenPreamble = true
  }
}

function formatLabel(tag: string): string {
  if (tag.startsWith('[') && tag.endsWith(']')) {
    return tag
  }

  return `[${tag}]`
}

function getCompleteLabel(label: string | StepProgressLabel): string {
  return typeof label === 'string' ? label : label.complete
}

function getRunningLabel(label: string | StepProgressLabel): string {
  return typeof label === 'string' ? label : (label.running ?? label.complete)
}
