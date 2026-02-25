import { describe, expect, it } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { basicPropsPlugin } from './basic-props-plugin.ts'
import { stylePropsPlugin } from './style-props-plugin.ts'

describe('style props plugin', () => {
  it('applies style object updates and teardown cleanup', () => {
    let reconciler = createDomReconciler(document, [
      stylePropsPlugin as any,
      basicPropsPlugin as any,
    ])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)
    let stableStyle = {
      width: 10,
      opacity: 0.5,
      '--tone': 3,
    }

    root.render(<div style={stableStyle}>a</div>)
    root.flush()

    let node = container.firstElementChild as HTMLDivElement
    expect(node.style.width).toBe('10px')
    expect(node.style.opacity).toBe('0.5')
    expect(node.style.getPropertyValue('--tone')).toBe('3')

    root.render(<div style={stableStyle}>a</div>)
    root.flush()
    expect(node.style.width).toBe('10px')

    root.render(<div style={{ opacity: 1, width: null as any }}>a</div>)
    root.flush()
    expect(node.style.opacity).toBe('1')
    expect(node.style.width).toBe('')

    root.render(<div>a</div>)
    root.flush()
    expect(node.style.opacity).toBe('')
    expect(node.style.getPropertyValue('--tone')).toBe('')
  })
})
