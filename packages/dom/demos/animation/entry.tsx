import { createDomReconciler } from '@remix-run/dom'
import { AnimateLayout } from './animate-layout.tsx'
import { EnterAnimation } from './enter.tsx'
import { ExitAnimation } from './exit.tsx'
import { RollingSquare } from './rolling-square.tsx'
import { Tile } from './tile.tsx'
import { container, grid, page } from './styles.ts'

type DemoHandle = {
  update(): Promise<AbortSignal>
}

function App(_handle: DemoHandle, _setup: unknown) {
  return () => (
    <main mix={[page]}>
      <div mix={[container]}>
        <h1 style={{ marginBottom: 0 }}>Animations</h1>
        <p style={{ marginTop: 8, color: '#475569' }}>
          Port of the first four tiles from the component animation demo.
        </p>
        <div mix={[grid]}>
          <Tile title="Default Animate" notes="Enter + layout spring animation">
            <AnimateLayout />
          </Tile>
          <Tile title="Rolling Square" notes="CSS transition with spring() timing">
            <RollingSquare />
          </Tile>
          <Tile title="Enter Animation" notes="Spring enter keyframes">
            <EnterAnimation />
          </Tile>
          <Tile title="Exit Animation" notes="Spring enter + exit transitions">
            <ExitAnimation />
          </Tile>
        </div>
      </div>
    </main>
  )
}

document.body.style.margin = '0'
let reconciler = createDomReconciler(document)
let root = reconciler.createRoot(document.body)
root.render(<App />)
