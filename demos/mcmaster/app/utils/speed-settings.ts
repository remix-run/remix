import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createCookie } from 'remix/cookie'

export interface SpeedSettings {
  /** Whether prefetching, soft navigation, compression, and HTTP caching are enabled. */
  techniques: boolean
  /** Extra milliseconds added to every request to simulate a real network round trip. */
  latency: number
}

export const latencyOptions: readonly number[] = [0, 100, 300, 800]

export const defaultSpeedSettings: SpeedSettings = { techniques: true, latency: 0 }

export const speedSettingsCookie = createCookie('speed-settings', {
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
})

const speedSettingsSchema = f.object({
  techniques: f.field(s.defaulted(s.enum_(['on', 'off']), 'on')),
  latency: f.field(s.defaulted(s.string(), '0')),
})

export function parseSpeedSettings(input: FormData | URLSearchParams): SpeedSettings {
  let result = s.parseSafe(speedSettingsSchema, input)
  if (!result.success) return defaultSpeedSettings

  let latency = Number(result.value.latency)

  return {
    techniques: result.value.techniques === 'on',
    latency: latencyOptions.includes(latency) ? latency : defaultSpeedSettings.latency,
  }
}

export async function readSpeedSettings(cookieHeader: string | null): Promise<SpeedSettings> {
  let value = await speedSettingsCookie.parse(cookieHeader)
  return value == null ? defaultSpeedSettings : parseSpeedSettings(new URLSearchParams(value))
}

export function serializeSpeedSettings(settings: SpeedSettings): Promise<string> {
  let value = new URLSearchParams({
    techniques: settings.techniques ? 'on' : 'off',
    latency: String(settings.latency),
  })
  return speedSettingsCookie.serialize(value.toString())
}
