import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot } from '../lib/vdom.ts'

describe('animate', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  describe('rendering', () => {
    it('renders element with animate prop', () => {
      let root = createRoot(container)
      root.render(<div animate={{ enter: true }}>Hello</div>)
      root.flush()

      let div = container.querySelector('div')
      expect(div).not.toBeNull()
      expect(div?.textContent).toBe('Hello')
    })

    it('renders element with animate config', () => {
      let root = createRoot(container)
      root.render(<div animate={{ enter: { opacity: 0, duration: 10 } }}>Hello</div>)
      root.flush()

      let div = container.querySelector('div')
      expect(div).not.toBeNull()
      expect(div?.textContent).toBe('Hello')
    })
  })

  describe('enter animation', () => {
    it('calls element.animate on mount with enter config', () => {
      let root = createRoot(container)
      let animateCalled = false

      root.render(
        <div
          animate={{ enter: { opacity: 0, duration: 10 } }}
          connect={(node) => {
            let original = node.animate.bind(node)
            node.animate = (keyframes, options) => {
              animateCalled = true
              return original(keyframes, options)
            }
          }}
        >
          Hello
        </div>,
      )
      root.flush()

      expect(animateCalled).toBe(true)
    })

    it('animates from enter keyframe to natural styles', () => {
      let root = createRoot(container)
      let animateCall: { keyframes: Keyframe[]; options: KeyframeAnimationOptions } | undefined

      root.render(
        <div
          animate={{
            enter: { opacity: 0, transform: 'scale(0.9)', duration: 10, easing: 'ease-out' },
          }}
          connect={(node) => {
            let original = node.animate.bind(node)
            node.animate = (keyframes, options) => {
              animateCall = {
                keyframes: keyframes as Keyframe[],
                options: options as KeyframeAnimationOptions,
              }
              return original(keyframes, options)
            }
          }}
        >
          Hello
        </div>,
      )
      root.flush()

      expect(animateCall).toBeDefined()
      expect(animateCall?.keyframes).toHaveLength(2)
      expect(animateCall?.keyframes[0]).toMatchObject({ opacity: 0, transform: 'scale(0.9)' })
      expect(animateCall?.options.duration).toBe(10)
      expect(animateCall?.options.easing).toBe('ease-out')
    })

    it('uses default fade animation for enter: true', () => {
      let root = createRoot(container)
      let animateCall: { keyframes: Keyframe[]; options: KeyframeAnimationOptions } | undefined

      root.render(
        <div
          animate={{ enter: true }}
          connect={(node) => {
            let original = node.animate.bind(node)
            node.animate = (keyframes, options) => {
              animateCall = {
                keyframes: keyframes as Keyframe[],
                options: options as KeyframeAnimationOptions,
              }
              return original(keyframes, options)
            }
          }}
        >
          Hello
        </div>,
      )
      root.flush()

      expect(animateCall).toBeDefined()
      expect(animateCall?.keyframes[0]).toMatchObject({ opacity: 0 })
      expect(animateCall?.options.duration).toBe(150)
    })

    it('supports full keyframes array', () => {
      let root = createRoot(container)
      let animateCall: { keyframes: Keyframe[] } | undefined

      root.render(
        <div
          animate={{
            enter: {
              keyframes: [
                { opacity: 0, transform: 'scale(0.8)' },
                { opacity: 1, transform: 'scale(1.05)', offset: 0.7 },
                { opacity: 1, transform: 'scale(1)' },
              ],
              duration: 10,
            },
          }}
          connect={(node) => {
            let original = node.animate.bind(node)
            node.animate = (keyframes, options) => {
              animateCall = { keyframes: keyframes as Keyframe[] }
              return original(keyframes, options)
            }
          }}
        >
          Hello
        </div>,
      )
      root.flush()

      expect(animateCall).toBeDefined()
      expect(animateCall?.keyframes).toHaveLength(3)
      expect(animateCall?.keyframes[1]).toMatchObject({ offset: 0.7 })
    })
  })

  describe('exit animation', () => {
    it('plays exit animation even when enter was disabled at mount', async () => {
      // Regression test: exit animations should play even if the element was
      // rendered with enter: false initially (e.g., skip enter on initial mount)
      let root = createRoot(container)
      let show = true
      let animation: Animation | undefined

      function App() {
        return () =>
          show ? (
            <div
              animate={{
                enter: false, // Simulates skipping enter animation at initial mount
                exit: { opacity: 0, duration: 50 },
              }}
              connect={(node) => {
                let original = node.animate.bind(node)
                node.animate = (keyframes, options) => {
                  animation = original(keyframes, options)
                  return animation
                }
              }}
            >
              Hello
            </div>
          ) : null
      }

      root.render(<App />)
      root.flush()

      // Enter animation should NOT have been called (enter: false)
      expect(animation).toBeUndefined()
      expect(container.querySelector('div')).not.toBeNull()

      // Remove element
      show = false
      root.render(<App />)
      root.flush()

      // Exit animation SHOULD play even though enter: false
      expect(animation).toBeDefined()
      expect(container.querySelector('div')).not.toBeNull()

      // Wait for animation to complete
      await animation?.finished

      // Now element should be removed
      expect(container.querySelector('div')).toBeNull()
    })

    it('keeps element in DOM during exit animation', async () => {
      let root = createRoot(container)
      let show = true
      let animation: Animation | undefined

      function App() {
        return () =>
          show ? (
            <div
              animate={{ exit: { opacity: 0, duration: 50 } }}
              connect={(node) => {
                let original = node.animate.bind(node)
                node.animate = (keyframes, options) => {
                  animation = original(keyframes, options)
                  return animation
                }
              }}
            >
              Hello
            </div>
          ) : null
      }

      root.render(<App />)
      root.flush()

      expect(container.querySelector('div')).not.toBeNull()

      // Remove element
      show = false
      root.render(<App />)
      root.flush()

      // Element should still be in DOM during exit animation
      expect(container.querySelector('div')).not.toBeNull()
      // Exit animation should have started
      expect(animation).toBeDefined()

      // Wait for animation to complete using the finished promise
      await animation?.finished

      // Now element should be removed
      expect(container.querySelector('div')).toBeNull()
    })

    it('does not keep element in DOM without exit config', () => {
      let root = createRoot(container)
      let show = true

      function App() {
        return () =>
          show ? <div animate={{ enter: { opacity: 0, duration: 10 } }}>Hello</div> : null
      }

      root.render(<App />)
      root.flush()

      expect(container.querySelector('div')).not.toBeNull()

      // Remove element
      show = false
      root.render(<App />)
      root.flush()

      // Element should be immediately removed (no exit animation)
      expect(container.querySelector('div')).toBeNull()
    })
  })

  describe('ternary switching', () => {
    it('plays both exit and enter animations when switching between keyed components', async () => {
      // Regression test: when using `cond ? <A /> : <B />` pattern with different keys,
      // A should exit while B enters independently. The new element should NOT reclaim
      // the exiting element's DOM/animation.
      let root = createRoot(container)
      let state = true
      let exitAnimation: Animation | undefined
      let enterAnimation: Animation | undefined

      function Circle() {
        return (props: { filled?: boolean }) => (
          <div
            className="circle"
            data-filled={props.filled}
            animate={{
              enter: { opacity: 0, transform: 'scale(0.8)', duration: 100 },
              exit: { opacity: 0, transform: 'scale(0.8)', duration: 100 },
            }}
            connect={(node) => {
              let original = node.animate.bind(node)
              node.animate = (keyframes, options) => {
                let anim = original(keyframes, options)
                if (props.filled) {
                  exitAnimation = anim
                } else {
                  enterAnimation = anim
                }
                return anim
              }
            }}
          >
            {props.filled ? 'Filled' : 'Outline'}
          </div>
        )
      }

      function App() {
        return () => <div>{state ? <Circle key="filled" filled /> : <Circle key="outline" />}</div>
      }

      root.render(<App />)
      root.flush()

      // Initial state: filled circle visible
      let circles = container.querySelectorAll('.circle')
      expect(circles).toHaveLength(1)
      expect(circles[0].getAttribute('data-filled')).toBe('true')

      // Switch to outline
      state = false
      root.render(<App />)
      root.flush()

      // Both circles should be in DOM: filled exiting, outline entering
      circles = container.querySelectorAll('.circle')
      expect(circles).toHaveLength(2)

      // Exit animation should be playing on filled circle
      expect(exitAnimation).toBeDefined()
      expect(exitAnimation?.playState).toBe('running')

      // Enter animation should be playing on outline circle
      expect(enterAnimation).toBeDefined()
      expect(enterAnimation?.playState).toBe('running')

      // Wait for animations to complete
      await Promise.all([exitAnimation?.finished, enterAnimation?.finished])

      // Only outline circle should remain
      circles = container.querySelectorAll('.circle')
      expect(circles).toHaveLength(1)
      expect(circles[0].getAttribute('data-filled')).toBeNull()
    })
  })

  describe('interruption', () => {
    it('reverses enter animation when removed mid-flight', async () => {
      let root = createRoot(container)
      let show = true
      let animation: Animation | undefined

      function App() {
        return () =>
          show ? (
            <div
              animate={{
                enter: { opacity: 0, duration: 100 },
                exit: { opacity: 0, duration: 100 },
              }}
              connect={(node) => {
                let original = node.animate.bind(node)
                node.animate = (keyframes, options) => {
                  animation = original(keyframes, options)
                  return animation
                }
              }}
            >
              Hello
            </div>
          ) : null
      }

      root.render(<App />)
      root.flush()

      // Wait a bit for enter animation to be in progress
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(animation?.playState).toBe('running')

      // Remove while enter animation is running
      show = false
      root.render(<App />)
      root.flush()

      // Element should still be in DOM (exiting via reversed enter animation)
      expect(container.querySelector('div')).not.toBeNull()

      // Wait for the reversed animation to complete
      await animation?.finished

      // Now element should be removed
      expect(container.querySelector('div')).toBeNull()
    })

    it('reverses exit animation when re-added mid-flight', async () => {
      let root = createRoot(container)
      let show = true
      let animation: Animation | undefined

      function App() {
        return () =>
          show ? (
            <div
              animate={{
                enter: { opacity: 0, duration: 100 },
                exit: { opacity: 0, duration: 100 },
              }}
              connect={(node) => {
                let original = node.animate.bind(node)
                node.animate = (keyframes, options) => {
                  animation = original(keyframes, options)
                  return animation
                }
              }}
            >
              Hello
            </div>
          ) : null
      }

      root.render(<App />)
      root.flush()

      // Wait for enter animation to complete
      await new Promise((resolve) => setTimeout(resolve, 120))

      // Start exit
      show = false
      root.render(<App />)
      root.flush()

      // Wait a bit for exit animation to be in progress
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(animation?.playState).toBe('running')

      // Re-add while exit animation is running
      show = true
      root.render(<App />)
      root.flush()

      // Element should still be in DOM (reclaimed from exiting)
      expect(container.querySelector('div')).not.toBeNull()

      // Wait for animation to settle
      await animation?.finished

      // Element should still be visible
      expect(container.querySelector('div')).not.toBeNull()
    })
  })
})
