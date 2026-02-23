import { spring } from '@remix-run/dom'

type DemoHandle = {
  update(): Promise<AbortSignal>
}

export function EnterAnimation(_handle: DemoHandle, _setup: unknown) {
  return () => (
    <div
      style={{ width: 100, height: 100, borderRadius: '50%', backgroundColor: '#dd00ee', transition: `transform ${spring()}, opacity ${spring()}` }}
    />
  )
}
