import * as process from 'node:process'

import { readRemixVersion } from './remix-version.ts'
import {
  bold,
  canUseAnsi,
  clearCurrentLine,
  lightGray,
  lightGreen,
  lightRed,
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
  label(tag: string, text: string): string
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
  return {
    out: new ReporterTextChannel(options.stdout ?? process.stdout),
    status: new ReporterStatusChannel(
      options.stderr ?? process.stderr,
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
  #pendingBlank = false
  #stream: NodeJS.WriteStream
  #hasWrittenContent = false

  constructor(stream: NodeJS.WriteStream) {
    this.#stream = stream
  }

  blank(): void {
    if (!this.#hasWrittenContent) {
      return
    }

    this.#pendingBlank = true
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

  label(tag: string, text: string): string {
    return `${formatLabel(tag)} ${text}`
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

  protected getStream(): NodeJS.WriteStream {
    return this.#stream
  }

  protected noteImmediateWrite(): void {
    this.#hasWrittenContent = true
    this.#pendingBlank = false
  }

  protected writeImmediate(text: string): void {
    this.#write(text)
  }

  protected getIndentText(): string {
    return this.#getIndent()
  }

  #flushPendingBlank(): void {
    if (!this.#pendingBlank) {
      return
    }

    this.#write('\n')
    this.#pendingBlank = false
  }

  #getIndent(): string {
    return DEFAULT_INDENT.repeat(this.#indentLevel)
  }

  #write(text: string): void {
    this.#stream.write(text)
    this.#hasWrittenContent = true
  }
}

class ReporterStatusChannel extends ReporterTextChannel implements StatusChannel {
  #activeLabel: string | null = null
  #activeTimer: NodeJS.Timeout | null = null
  #frameIndex = 0
  #frameIntervalMs: number
  #hasRenderedStep = false
  #hasWrittenSummaryGap = false

  constructor(stream: NodeJS.WriteStream, frameIntervalMs: number) {
    super(stream)
    this.#frameIntervalMs = frameIntervalMs
  }

  async commandHeader(commandLabel: string): Promise<void> {
    if (!this.getStream().isTTY) {
      return
    }

    try {
      let version = readRemixVersion()
      this.writeImmediate(`\n${remixWordmark(this.getStream())} v${version} - ${commandLabel}\n\n`)
      this.noteImmediateWrite()
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
    this.noteImmediateWrite()
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
    this.noteImmediateWrite()
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
      this.noteImmediateWrite()
      return
    }

    this.writeImmediate(`${line}\n`)
    this.noteImmediateWrite()
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
