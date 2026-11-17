import * as path from 'node:path'
import { Readable } from 'node:stream'
import type { TestEvent } from 'node:test/reporters'
import { spec } from 'node:test/reporters'
import { styleText } from 'node:util'

export default async function* reporter(
  source: AsyncIterable<TestEvent>,
): AsyncGenerator<string | Buffer> {
  let events = process.env.CI === 'true' ? fileEvents(source) : source
  yield* Readable.from(events).compose(new spec())
}

async function* fileEvents(source: AsyncIterable<TestEvent>): AsyncGenerator<TestEvent> {
  for await (let event of source) {
    if (event.type === 'test:start' || event.type === 'test:pass') {
      continue
    }

    if (event.type === 'test:summary' && event.data.file !== undefined) {
      let fileName = path.relative(process.cwd(), event.data.file)
      let duration = event.data.success ? ` (${event.data.duration_ms.toFixed(2)}ms)` : ''
      yield {
        type: 'test:stdout',
        data: {
          file: event.data.file,
          message: `▶ ${styleText(event.data.success ? 'green' : 'red', fileName)}${duration}\n`,
        },
      }
    } else {
      yield event
    }
  }
}
