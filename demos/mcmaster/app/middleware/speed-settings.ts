import { compression } from 'remix/middleware/compression'
import { getContext } from 'remix/middleware/async-context'
import { createContextKey, type Middleware } from 'remix/router'

import { readSpeedSettings, type SpeedSettings } from '../utils/speed-settings.ts'

export const speedSettingsContext = createContextKey<SpeedSettings>()

export function loadSpeedSettings(): Middleware<{
  key: typeof speedSettingsContext
  value: SpeedSettings
  property: 'speedSettings'
}> {
  return async (context, next) => {
    let settings = await readSpeedSettings(context.headers.get('Cookie'))
    context.set(speedSettingsContext, settings, { property: 'speedSettings' })
    return next()
  }
}

export function getSpeedSettings(): SpeedSettings {
  return getContext().get(speedSettingsContext)
}

/**
 * Compresses responses when the speed techniques are on. When they are off, every response is
 * sent uncompressed with `Cache-Control: no-store`, like a site that never invested in caching.
 */
export function applySpeedTechniques(): Middleware {
  let compress = compression()

  return async (context, next) => {
    let settings = context.get(speedSettingsContext)
    if (settings == null) {
      throw new Error('Expected loadSpeedSettings() middleware before applySpeedTechniques()')
    }

    if (settings.techniques) return compress(context, next)

    let response = await next()
    let headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store')
    headers.delete('ETag')
    headers.delete('Last-Modified')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
