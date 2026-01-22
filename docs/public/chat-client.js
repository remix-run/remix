// Chat client-side logic
(function () {
  let modal = document.getElementById('chatModal')
  let closeButton = document.getElementById('chatClose')
  let form = document.getElementById('chatForm')
  let input = document.getElementById('chatInput')
  let sendButton = document.getElementById('chatSend')
  let messagesContainer = document.getElementById('chatMessages')

  let messageHistory = []
  let isStreaming = false

  // Keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    // Cmd+K or Ctrl+K to open
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      openChat()
    }

    // Escape to close
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
      closeChat()
    }
  })

  // Close button
  closeButton.addEventListener('click', closeChat)

  // Click outside to close
  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      closeChat()
    }
  })

  // Form submission
  form.addEventListener('submit', async function (e) {
    e.preventDefault()
    await sendMessage()
  })

  // Auto-resize textarea
  input.addEventListener('input', function () {
    this.style.height = 'auto'
    this.style.height = this.scrollHeight + 'px'
  })

  // Enter to send, Shift+Enter for new line
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isStreaming && input.value.trim()) {
        form.dispatchEvent(new Event('submit'))
      }
    }
  })

  function openChat() {
    modal.classList.add('visible')
    input.focus()
  }

  function closeChat() {
    modal.classList.remove('visible')
  }

  function addMessage(role, content) {
    let messageDiv = document.createElement('div')
    messageDiv.className = 'chat-message ' + role

    let roleDiv = document.createElement('div')
    roleDiv.className = 'chat-message-role'
    roleDiv.textContent = role === 'user' ? 'You' : 'Assistant'

    let contentDiv = document.createElement('div')
    contentDiv.className = 'chat-message-content'

    if (role === 'assistant') {
      // Render markdown for assistant messages
      contentDiv.innerHTML = renderMarkdown(content)
    } else {
      contentDiv.textContent = content
    }

    messageDiv.appendChild(roleDiv)
    messageDiv.appendChild(contentDiv)
    messagesContainer.appendChild(messageDiv)

    scrollToBottom()

    return contentDiv
  }

  function addTypingIndicator() {
    let typingDiv = document.createElement('div')
    typingDiv.className = 'chat-typing'
    typingDiv.id = 'typingIndicator'

    for (let i = 0; i < 3; i++) {
      let dot = document.createElement('div')
      dot.className = 'chat-typing-dot'
      typingDiv.appendChild(dot)
    }

    messagesContainer.appendChild(typingDiv)
    scrollToBottom()

    return typingDiv
  }

  function removeTypingIndicator() {
    let indicator = document.getElementById('typingIndicator')
    if (indicator) {
      indicator.remove()
    }
  }

  function addError(message) {
    let errorDiv = document.createElement('div')
    errorDiv.className = 'chat-error'
    errorDiv.textContent = 'Error: ' + message
    messagesContainer.appendChild(errorDiv)
    scrollToBottom()
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  async function sendMessage() {
    let message = input.value.trim()
    if (!message || isStreaming) return

    // Add user message to UI
    addMessage('user', message)

    // Clear input
    input.value = ''
    input.style.height = 'auto'

    // Add to history
    messageHistory.push({ role: 'user', content: message })

    // Show typing indicator
    addTypingIndicator()

    // Disable input
    isStreaming = true
    sendButton.disabled = true
    input.disabled = true

    try {
      let response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          history: messageHistory.slice(0, -1), // Don't include the current message
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response from server')
      }

      // Remove typing indicator
      removeTypingIndicator()

      // Create assistant message div
      let assistantContent = ''
      let contentDiv = addMessage('assistant', '')

      // Stream the response
      let reader = response.body.getReader()
      let decoder = new TextDecoder()

      while (true) {
        let { done, value } = await reader.read()

        if (done) break

        let chunk = decoder.decode(value)
        let lines = chunk.split('\n')

        for (let line of lines) {
          if (line.startsWith('data: ')) {
            try {
              let data = JSON.parse(line.slice(6))

              if (data.token) {
                assistantContent += data.token
                contentDiv.innerHTML = renderMarkdown(assistantContent)
                scrollToBottom()
              }

              if (data.done) {
                // Add to history
                messageHistory.push({ role: 'assistant', content: assistantContent })
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      removeTypingIndicator()
      addError(error.message || 'An error occurred while processing your request')
    } finally {
      // Re-enable input
      isStreaming = false
      sendButton.disabled = false
      input.disabled = false
      input.focus()
    }
  }

  function renderMarkdown(text) {
    // Simple markdown rendering (code blocks and inline code)
    let html = text

    // Escape HTML
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function (match, lang, code) {
      return '<pre><code>' + code.trim() + '</code></pre>'
    })

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

    // Line breaks
    html = html.replace(/\n/g, '<br>')

    return html
  }
})()
