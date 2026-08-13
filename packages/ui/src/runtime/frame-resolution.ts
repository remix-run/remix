import type { FrameContent, FrameResolution } from './component.ts'

export async function unwrapFrameResolution(
  resolution: FrameResolution,
): Promise<{ content: FrameContent; redirectedTo?: string }> {
  if (!(resolution instanceof Response)) return { content: resolution }

  if (resolution.status >= 500) {
    throw new Error(
      `Failed to resolve frame: ${resolution.status} ${resolution.statusText}`.trimEnd(),
    )
  }

  let content = resolution.body ?? (await resolution.text())
  return {
    content,
    redirectedTo: resolution.redirected && resolution.url ? resolution.url : undefined,
  }
}
