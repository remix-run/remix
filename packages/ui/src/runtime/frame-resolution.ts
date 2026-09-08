import type { FrameContent, FrameResolution } from './component.ts'
import { getSpaResponseData } from './spa-response.ts'

export async function unwrapFrameResolution(
  resolution: FrameResolution,
): Promise<{ content: FrameContent; redirectedTo?: string }> {
  if (!(resolution instanceof Response)) return { content: resolution }

  let data = getSpaResponseData(resolution)
  if (data) {
    return {
      content: data.node,
      redirectedTo: data.redirectedTo,
    }
  }

  let content = resolution.body ?? (await resolution.text())
  return {
    content,
    redirectedTo: resolution.redirected && resolution.url ? resolution.url : undefined,
  }
}
