import * as process from 'node:process'

import { readRemixVersion } from './remix-version.ts'
import { canUseAnsi, lightGray, lightGreen, lightRed, remixWordmark } from './terminal.ts'

const ANSI_CLEAR_LINE = '\u001B[2K'
const ANSI_CURSOR_TO_START = '\r'
const BULLET = '•'
const DOT_FRAMES = ['.', '..', '...'] as const

interface ProgressReporterOptions {
  frameIntervalMs?: number
}

export interface ProgressReporter {
  fail(label?: string): void
  skip(label: string, reason?: string): void
  start(label: string): void
  succeed(label?: string): void
  writeSummaryGap(): void
}

export interface StepProgressReporter<step extends string> {
  fail(step: step): void
  skip(step: step, reason?: string): void
  start(step: step): void
  succeed(step: step): void
  writeSummaryGap(): void
}

export function createProgressReporter(
  target: NodeJS.WriteStream = process.stdout,
  options: ProgressReporterOptions = {},
): ProgressReporter {
  let activeLabel: string | null = null
  let activeTimer: NodeJS.Timeout | null = null
  let frameIndex = 0
  let frameIntervalMs = options.frameIntervalMs ?? 250
  let hasRenderedStep = false
  let hasWrittenSummaryGap = false
  let interactive = canUseAnsi(target)

  return {
    fail(label = activeLabel ?? '') {
      stopAnimation()
      activeLabel = null
      noteStepOutput()
      writeFinalLine(target, interactive, formatFailedLine(label, target))
    },
    skip(label, reason) {
      stopAnimation()
      if (activeLabel === label) {
        activeLabel = null
      }
      noteStepOutput()
      writeFinalLine(target, interactive, formatSkippedLine(label, reason, target))
    },
    start(label) {
      stopAnimation()
      activeLabel = label
      noteStepOutput()
      if (interactive) {
        frameIndex = 0
        target.write(renderLiveLine(formatRunningLine(label, DOT_FRAMES[frameIndex], target)))
        activeTimer = setInterval(() => {
          if (activeLabel == null) {
            return
          }

          frameIndex = (frameIndex + 1) % DOT_FRAMES.length
          target.write(
            renderLiveLine(formatRunningLine(activeLabel, DOT_FRAMES[frameIndex], target)),
          )
        }, frameIntervalMs)
        activeTimer.unref?.()
        return
      }

      target.write(`${BULLET} ${label}...\n`)
    },
    succeed(label = activeLabel ?? '') {
      stopAnimation()
      activeLabel = null
      noteStepOutput()
      writeFinalLine(target, interactive, formatSucceededLine(label, target))
    },
    writeSummaryGap() {
      if (!hasRenderedStep || hasWrittenSummaryGap) {
        return
      }

      target.write('\n')
      hasWrittenSummaryGap = true
    },
  }

  function stopAnimation(): void {
    if (activeTimer != null) {
      clearInterval(activeTimer)
      activeTimer = null
    }
  }

  function noteStepOutput(): void {
    hasRenderedStep = true
    hasWrittenSummaryGap = false
  }
}

export function createStepProgressReporter<step extends string>(
  labels: Record<step, string>,
  target: NodeJS.WriteStream = process.stdout,
  options: ProgressReporterOptions = {},
): StepProgressReporter<step> {
  let progress = createProgressReporter(target, options)

  return {
    fail(step) {
      progress.fail(labels[step])
    },
    skip(step, reason) {
      progress.skip(labels[step], reason)
    },
    start(step) {
      progress.start(labels[step])
    },
    succeed(step) {
      progress.succeed(labels[step])
    },
    writeSummaryGap() {
      progress.writeSummaryGap()
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

export async function writeProgressCommandHeader(
  commandLabel: string,
  target: NodeJS.WriteStream = process.stdout,
): Promise<void> {
  if (!target.isTTY) {
    return
  }

  try {
    let version = readRemixVersion()
    target.write(`${remixWordmark(target)} ${version} (${commandLabel})\n\n`)
  } catch {}
}

function renderLiveLine(line: string): string {
  return `${ANSI_CURSOR_TO_START}${ANSI_CLEAR_LINE}${line}`
}

function formatRunningLine(label: string, dots: string, target: NodeJS.WriteStream): string {
  return lightGray(`${BULLET} ${label}${dots}`, target)
}

function formatSucceededLine(label: string, target: NodeJS.WriteStream): string {
  return `${lightGreen('✓', target)} ${lightGray(label, target)}`
}

function formatFailedLine(label: string, target: NodeJS.WriteStream): string {
  return `${lightRed('✗', target)} ${lightGray(label, target)}`
}

function formatSkippedLine(
  label: string,
  reason: string | undefined,
  target: NodeJS.WriteStream,
): string {
  let line = reason == null ? `${BULLET} ${label}` : `${BULLET} ${label} (skipped: ${reason})`
  return lightGray(line, target)
}

function writeFinalLine(target: NodeJS.WriteStream, interactive: boolean, line: string): void {
  if (interactive) {
    target.write(`${renderLiveLine(line)}\n`)
    return
  }

  target.write(`${line}\n`)
}
