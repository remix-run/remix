import { createRoot } from 'remix/component'
import type { Handle } from 'remix/component'
import { draggable } from './draggable.tsx'

function App(_handle: Handle) {
  return () => (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
      <h1>Draggable mixin demo</h1>
      <p>Drag the box with your mouse or trackpad.</p>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '720px',
          height: '420px',
          border: '1px dashed #c2c2c2',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#fafafa',
        }}
      >
        <div
          mix={[draggable(true)]}
          style={{
            position: 'absolute',
            left: '24px',
            top: '24px',
            width: '180px',
            padding: '14px 16px',
            borderRadius: '10px',
            backgroundColor: '#2563eb',
            color: 'white',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
            userSelect: 'none',
            touchAction: 'none',
            cursor: 'grab',
          }}
        >
          drag me
        </div>
      </div>
    </main>
  )
}

createRoot(document.body).render(<App />)
