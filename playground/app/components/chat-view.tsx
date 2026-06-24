import type { UIMessage } from 'ai'
import { micromark } from 'micromark'
import { css, on, ref, type Dispatched, type Handle } from 'remix/ui'

import type { Chat } from '../chat.ts'

// --- Typed custom events -----------------------------------------------------
// Following the framework convention (see `file-tabs.tsx` / `layout.tsx`):
// define a real `Event` subclass per event, then augment the global
// `HTMLElementEventMap` so both `on(...)` mixins and `addEventListener(...)`
// resolve the event type.
export const CHAT_SUBMIT_EVENT = 'chat-submit' as const

/** Fired when the user submits a message from the chat composer. */
export class ChatSubmitEvent extends Event {
  readonly message: string
  constructor(message: string) {
    super(CHAT_SUBMIT_EVENT, { bubbles: true })
    this.message = message
  }
}

declare global {
  interface HTMLElementEventMap {
    [CHAT_SUBMIT_EVENT]: ChatSubmitEvent
  }
}

type ChatSubmitEventHandler<E extends Event, target extends HTMLElement> = (
  event: Dispatched<E, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** `on(...)` helper for the `chat-submit` event with a typed handler. */
export function onChatSubmit<target extends HTMLElement>(
  handler: ChatSubmitEventHandler<ChatSubmitEvent, target>,
  capture?: boolean,
) {
  return on(CHAT_SUBMIT_EVENT, handler, capture)
}

export type ChatViewProps = {
  chat: Chat<UIMessage>
}

/**
 * Presentational agent-chat view: renders the message transcript and a
 * composer. It never owns chat data — it reads everything from the `chat`
 * prop and emits a `ChatSubmitEvent` (`chat-submit`) so the owner can decide
 * how to send the message (e.g. after refreshing diagnostics). Stopping an
 * in-flight response is a pure chat-control concern, so it calls
 * `chat.stop()` directly.
 */
export function ChatView(handle: Handle<ChatViewProps>) {
  // Re-render the transcript locally on chat changes (streaming text, status,
  // tool calls) so message updates don't force a full app re-render. Batch a
  // burst of streaming deltas into a single update.
  let batchTimeout: ReturnType<typeof setTimeout> | null = null
  let updateBatched = () => {
    if (batchTimeout) return
    batchTimeout = setTimeout(() => {
      batchTimeout = null
      handle.update()
    }, 100)
  }

  // Auto-scroll behavior: keep the transcript pinned to the bottom while the
  // user is already at the bottom. If they scroll up, stop following; when they
  // scroll back to the bottom, resume. A ResizeObserver watches the container
  // (and its growing content) so we re-pin after the new layout is measured,
  // not while a stale `scrollHeight` is still in effect.
  let scrollEl: HTMLElement | null = null
  let autoScroll = true
  // Wiggle room (px) so that being "close enough" to the bottom still counts as
  // being at the bottom (sub-pixel rounding, in-flight streaming, etc.).
  let BOTTOM_THRESHOLD = 48
  let isAtBottom = (el: HTMLElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD
  let scrollToBottom = (el: HTMLElement) => {
    el.scrollTop = el.scrollHeight
  }

  let unsubscribe = handle.props.chat.subscribe(updateBatched)
  handle.signal.addEventListener(
    'abort',
    () => {
      if (batchTimeout) clearTimeout(batchTimeout)
      unsubscribe()
    },
    { once: true },
  )

  return () => {
    let chat = handle.props.chat

    return (
      <jui-stack grow mix={css({ minHeight: 0 })}>
        <header bg="neutral" p="xs" border="bottom">
          <jui-group gap="md" items="center" nowrap>
            <span font="xs">Agent Chat</span>
          </jui-group>
        </header>

        <main
          p="md"
          grow
          scrolly
          mix={[
            ref((node: HTMLElement, signal) => {
              if (scrollEl === node) {
                // Re-render while following the bottom: re-pin once layout settles.
                if (autoScroll) requestAnimationFrame(() => scrollToBottom(node))
                return
              }
              scrollEl = node

              // User-driven scrolling toggles whether we keep following.
              node.addEventListener(
                'scroll',
                () => {
                  autoScroll = isAtBottom(node)
                },
                { signal },
              )

              // Re-pin whenever the container or its content grows (streaming
              // text, new messages, the "Working..." indicator, etc.).
              let observer = new ResizeObserver(() => {
                if (autoScroll) scrollToBottom(node)
              })
              observer.observe(node)
              for (let child of Array.from(node.children)) observer.observe(child)
              signal.addEventListener('abort', () => observer.disconnect(), { once: true })

              // Start pinned to the bottom on load.
              requestAnimationFrame(() => scrollToBottom(node))
            }),
          ]}
        >
          <jui-container center>
            <jui-stack gap="md">
              {chat.messages.map((m) => (
                <jui-group nowrap gap="sm" justify={m.role === 'user' ? 'end' : 'start'}>
                  {m.role === 'assistant' && (
                    <div>
                      <jui-badge aspect="square">
                        <svg
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                          />
                        </svg>
                      </jui-badge>
                    </div>
                  )}
                  <jui-card maxw="md" grow>
                    <div bg={m.role === 'user' ? 'primary' : undefined} pl="md" pr="md" typography>
                      {m.parts.map((part, index) => {
                        switch (part.type) {
                          case 'text':
                            return <div innerHTML={micromark(part.text)} />
                          default:
                            if (part.type.startsWith('tool-')) {
                              let { input, state, type } = part as {
                                type: `tool-${string}`
                                input: unknown
                                output: unknown
                                state: 'input-streaming' | 'output-streaming' | 'output-available'
                              }
                              let path =
                                typeof input === 'object' &&
                                input !== null &&
                                'path' in input &&
                                typeof input.path === 'string' &&
                                input.path
                              return (
                                <details key={index}>
                                  <summary
                                    mix={css({
                                      display: 'block',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    })}
                                  >
                                    {type}{' '}
                                    {`(${state === 'output-available' ? 'done' : 'in progress'})`}
                                    {path ? (
                                      <span
                                        mix={css({
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        })}
                                      >
                                        {' '}
                                        {path.split('/').slice(-2).join('/')}
                                      </span>
                                    ) : (
                                      ''
                                    )}
                                  </summary>
                                  <pre mix={wordWrap}>{JSON.stringify(input ?? null, null, 2)}</pre>
                                </details>
                              )
                            }
                            break
                        }
                        return null
                      })}
                    </div>
                  </jui-card>
                  {m.role === 'user' && (
                    <div>
                      <jui-badge aspect="square" variant="primary">
                        <svg
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                          />
                        </svg>
                      </jui-badge>
                    </div>
                  )}
                </jui-group>
              ))}
              {chat.state.status === 'submitted' || chat.state.status === 'streaming' ? (
                <p>Working...</p>
              ) : null}
            </jui-stack>
          </jui-container>
        </main>

        <footer bg="neutral" p="md" border="top">
          <jui-container center>
            <form
              mix={on('submit', (event) => {
                event.preventDefault()
                event.stopPropagation()
                let formData = new FormData(event.currentTarget, event.submitter)
                let message = formData.get('message')

                if (!message || typeof message !== 'string') return

                if (chat.status !== 'ready' && chat.status !== 'error') {
                  return
                }

                event.currentTarget.reset()
                event.currentTarget.dispatchEvent(new ChatSubmitEvent(message))
              })}
            >
              <jui-group gap="sm" items="end" nowrap>
                <jui-field grow>
                  <input
                    name="message"
                    type="text"
                    aria-label="Message"
                    placeholder="Send a message..."
                  />
                </jui-field>
                <jui-button variant="primary" size="icon">
                  {chat.state.status === 'error' || chat.state.status === 'ready' ? (
                    <button type="submit" aria-label="Send">
                      <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                        ></path>
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Stop"
                      mix={on('click', () => {
                        chat.stop()
                      })}
                    >
                      <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 0 1 9 14.437V9.564Z"
                        />
                      </svg>
                    </button>
                  )}
                </jui-button>
              </jui-group>
            </form>
          </jui-container>
        </footer>
      </jui-stack>
    )
  }
}

const wordWrap = css({
  fontFamily: '"IBM Plex Sans", sans-serif',
  whiteSpace: 'pre-wrap',
})
