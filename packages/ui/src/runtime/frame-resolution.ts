import type { FrameContent, FrameResolution } from './component.ts'
import { getSpaResponseRedirect, isSpaResponse, nodeFromSpaResponse } from './spa-response.ts'

export async function unwrapFrameResolution(
  resolution: FrameResolution,
): Promise<{ content: FrameContent; redirectedTo?: string }> {
  if (!(resolution instanceof Response)) return { content: resolution }

  if (isSpaResponse(resolution)) {
    return {
      content: nodeFromSpaResponse(resolution),
      redirectedTo: getSpaResponseRedirect(resolution),
    }
  }

  let content = resolution.body ?? (await resolution.text())
  return {
    content,
    redirectedTo: resolution.redirected && resolution.url ? resolution.url : undefined,
  }
}
