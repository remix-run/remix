import type { FrameHandle } from './component.ts'
import type { FormSubmission } from './form-navigation.ts'
import type { reloadFrameForNavigation } from './frame.ts'
import type { NavigationState } from './navigation.ts'

export interface NavigationFrameOptions {
  getTopFrame(): FrameHandle
  getNamedFrame(name: string): FrameHandle | undefined
  reloadFrame(
    frame: FrameHandle,
    options?: Parameters<typeof reloadFrameForNavigation>[1],
  ): ReturnType<typeof reloadFrameForNavigation>
}

export interface NavigationFrameResult {
  frame: FrameHandle
  topFrame: FrameHandle
  redirectedTo: string | undefined
}

export async function reloadNavigationFrame(
  destination: string,
  state: NavigationState,
  signal: AbortSignal,
  submission: FormSubmission | undefined,
  options: NavigationFrameOptions,
): Promise<NavigationFrameResult> {
  let topFrame = options.getTopFrame()
  let namedFrame = state.target ? options.getNamedFrame(state.target) : undefined
  let frame = namedFrame ?? topFrame

  topFrame.src = destination
  if (frame !== topFrame) frame.src = state.src
  let { redirectedTo } = await options.reloadFrame(frame, { ...submission, signal })

  return { frame, topFrame, redirectedTo }
}
