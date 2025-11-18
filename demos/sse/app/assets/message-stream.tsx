import { hydrated } from '@remix-run/dom'

import { routes } from '../../routes.ts'

export const MessageStream = hydrated(
  routes.assets.href({ path: 'message-stream.js#MessageStream' }),
  function (this) {
    let messages: Array<{ count: number; message: string }> = []
    let connected = false

    this.queueTask(() => {
      let eventSource = new EventSource(routes.messages.href())

      eventSource.addEventListener('open', () => {
        connected = true
        this.update()
      })

      eventSource.addEventListener('message', (event) => {
        let data = JSON.parse(event.data)
        messages.push(data)
        this.update()
      })

      eventSource.addEventListener('error', () => {
        connected = false
        this.update()
        eventSource.close()
      })

      this.signal.addEventListener('abort', () => {
        eventSource.close()
      })
    })

    return () => {
      return (
        <>
          <div
            css={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              marginBottom: '1.5rem',
            }}
          >
            <div
              css={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                background: connected ? '#e3f2fd' : '#ffebee',
                borderLeft: connected ? '4px solid #2196f3' : '4px solid #f44336',
                borderRadius: '4px',
                color: connected ? '#1976d2' : '#c62828',
                fontWeight: 500,
              }}
            >
              <span
                css={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: connected ? '#2196f3' : '#f44336',
                  animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
                }}
              />
              <span>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>

          <div
            css={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              minHeight: '200px',
            }}
          >
            <h2 css={{ color: '#333', marginBottom: '1rem', fontSize: '1.25rem' }}>Messages</h2>
            <ul css={{ listStyle: 'none' }}>
              {messages.length === 0 ? (
                <li css={{ textAlign: 'center', color: '#999', padding: '3rem 1rem' }}>
                  Waiting for messages...
                </li>
              ) : (
                messages.map((message) => (
                  <li
                    css={{
                      padding: '0.75rem 1rem',
                      background: '#f8f9fa',
                      borderLeft: '3px solid #4caf50',
                      borderRadius: '4px',
                      marginBottom: '0.5rem',
                      animation: 'slideIn 0.3s ease-out',
                    }}
                    key={message.count}
                  >
                    <span css={{ fontWeight: 600, color: '#4caf50' }}>#{message.count}</span>{' '}
                    <span css={{ color: '#666' }}>{message.message}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )
    }
  },
)
