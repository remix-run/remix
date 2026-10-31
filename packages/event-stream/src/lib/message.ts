export interface EventStreamMessage {
  event?: string
  id?: string
  retry?: number
  data: string
}

export function formatEventStreamMessage(message: EventStreamMessage): string {
  let lines: string[] = []

  if (message.id !== undefined) {
    lines.push(`id: ${validateFieldValue('id', message.id)}`)
  }

  if (message.event !== undefined) {
    lines.push(`event: ${validateFieldValue('event', message.event)}`)
  }

  if (message.retry !== undefined) {
    lines.push(`retry: ${validateRetry(message.retry)}`)
  }

  for (let line of splitDataLines(message.data)) {
    lines.push(`data: ${line}`)
  }

  lines.push('')
  return `${lines.join('\n')}\n`
}

function splitDataLines(data: string): string[] {
  return data.replace(/\r\n?/g, '\n').split('\n')
}

function validateFieldValue(field: string, value: string): string {
  if (value.includes('\r') || value.includes('\n')) {
    throw new TypeError(`SSE ${field} fields cannot contain line breaks`)
  }

  return value
}

function validateRetry(retry: number): number {
  if (!Number.isSafeInteger(retry) || retry < 0) {
    throw new RangeError('SSE retry must be a non-negative safe integer')
  }

  return retry
}
