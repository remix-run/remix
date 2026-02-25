import { on } from '@remix-run/dom'
import type { RenderValue } from '@remix-run/reconciler'
import { panel, replayButton, tileBody } from './styles.ts'

type DemoHandle = {
  update(): Promise<AbortSignal>
}

export function Tile(handle: DemoHandle, _setup: unknown) {
  let remountKey = 0
  return (props: { title: string; notes?: string; children: RenderValue }) => (
    <section mix={[panel]}>
      <button
        mix={[
          replayButton,
          on('click', () => {
            remountKey++
            void handle.update()
          }),
        ]}
        title="Replay animation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 4v6h6M23 20v-6h-6" />
          <path d="M20.5 9A9 9 0 0 0 5.7 5.6L1 10m22 4-4.6 4.4A9 9 0 0 1 3.5 15" />
        </svg>
      </button>
      <h3 style={{ margin: 0 }}>{props.title}</h3>
      <div key={remountKey} mix={[tileBody]}>
        {props.children}
      </div>
      {props.notes && <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{props.notes}</p>}
    </section>
  )
}
