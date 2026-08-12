import type { FrameContent, FrameResolution } from './component.ts'
import { getNodeResponseRedirect, isNodeResponse, nodeFromResponse } from './node-response.ts'

export async function unwrapFrameResolution(
  resolution: FrameResolution,
): Promise<{ content: FrameContent; redirectedTo?: string }> {
  if (!(resolution instanceof Response)) return { content: resolution }

  if (isNodeResponse(resolution)) {
    return {
      content: nodeFromResponse(resolution),
      redirectedTo: getNodeResponseRedirect(resolution),
    }
  }

  let content = resolution.body ?? (await resolution.text())
  return {
    content,
    redirectedTo: resolution.redirected && resolution.url ? resolution.url : undefined,
  }
}
