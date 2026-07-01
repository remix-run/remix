let nodeHmrParentProcess = false

export function hasNodeHmrParentProcess(): boolean {
  return nodeHmrParentProcess
}

export function markNodeHmrParentProcess(): void {
  nodeHmrParentProcess = true
}
