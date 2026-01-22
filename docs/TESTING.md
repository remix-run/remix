# Testing the AI Chatbot

## Prerequisites

Before testing, ensure you have:

1. **Ollama installed and running**:
   ```bash
   # Check if Ollama is running
   curl http://localhost:11434/api/version
   
   # If not running, start it
   ollama serve
   ```

2. **A model pulled**:
   ```bash
   # Pull the default model
   ollama pull llama3.2
   
   # Verify it's available
   ollama list
   ```

3. **Dependencies installed**:
   ```bash
   # From repo root
   pnpm install
   ```

## Running the Server

From the `docs` directory:

```bash
# Set environment variables (optional - these are defaults)
export LLM_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.2
export PORT=3000

# Start the server
pnpm serve
```

Or from the repo root:

```bash
pnpm --filter remix-the-docs run serve
```

The server should start and display:
```
Remix API docs server running on http://localhost:3000
Content index loaded: X docs, Y source files, Z demo files
```

## Testing the Chat Interface

### 1. Open the Docs Site

Navigate to `http://localhost:3000` in your browser.

### 2. Open the Chat Modal

Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux).

You should see a modal overlay with:
- A welcome message from the assistant
- A text input field
- A "Send" button
- Help text showing keyboard shortcuts

### 3. Test Questions

Try these questions to verify functionality:

**Basic Question:**
```
How do I create a cookie?
```
Expected: Should find the `createCookie` documentation and provide a relevant answer.

**Code Example:**
```
Show me an example of using sessions
```
Expected: Should search demos and source code for session usage examples.

**Middleware Question:**
```
What middleware does Remix provide?
```
Expected: Should list middleware from source code and docs.

**Routing Question:**
```
How does routing work?
```
Expected: Should reference routing documentation and examples.

### 4. Verify Features

- **Streaming**: Responses should appear token by token, not all at once
- **Markdown**: Code blocks should be formatted with syntax highlighting
- **Context**: Answers should reference specific files from the codebase
- **Keyboard shortcuts**: 
  - `Escape` should close the modal
  - `Cmd+K` / `Ctrl+K` should open it
  - `Enter` should send the message
  - `Shift+Enter` should add a new line

### 5. Check Console Output

In the terminal running the server, you should see log messages like:

```
Content index loaded: 186 docs, 150 source files, 60 demo files
Found 8 relevant content items for query: "How do I create a cookie?"
```

This confirms the content indexer is working and finding relevant context.

## Troubleshooting

### Chat doesn't open
- Check browser console for JavaScript errors
- Verify `chat-client.js` is loaded (check Network tab)

### No response or errors
- Check if Ollama is running: `curl http://localhost:11434/api/version`
- Check if the model exists: `ollama list`
- Look for errors in the server terminal

### "Cannot connect to Ollama"
```bash
# Start Ollama
ollama serve
```

### "Model not found"
```bash
# Pull the model
ollama pull llama3.2
```

### Poor quality answers
Try a different model:
```bash
# For better code understanding
ollama pull codellama

# Then update the environment
export OLLAMA_MODEL=codellama
```

### Content index is empty
Make sure docs are generated:
```bash
pnpm --filter remix-the-docs run docs
```

## Manual API Testing

You can also test the API directly with curl:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I create a cookie?", "history": []}'
```

You should see streaming SSE responses:
```
data: {"token": "To"}
data: {"token": " create"}
data: {"token": " a"}
...
data: {"done": true}
```

## Success Criteria

The implementation is successful if:

1. ✅ Server starts without errors
2. ✅ Content indexer discovers all docs, source files, and demos
3. ✅ Chat modal opens with `Cmd+K` / `Ctrl+K`
4. ✅ Questions receive relevant, streaming responses
5. ✅ Responses include context from docs, source, and demos
6. ✅ Code blocks are formatted correctly
7. ✅ Keyboard shortcuts work as expected
8. ✅ Modal closes with `Escape`
9. ✅ No console errors in browser or terminal
10. ✅ Can handle multiple questions in conversation
