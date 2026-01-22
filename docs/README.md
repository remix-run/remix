# Remix Documentation with AI Chatbot

This is the Remix API documentation site with an integrated AI chatbot powered by LLM.

## Features

- API documentation generated from TypeDoc
- AI chatbot that can answer questions about Remix
- Searches across documentation, source code, and demo applications
- Keyboard shortcut (Cmd+K or Ctrl+K) to open chat
- Streaming responses for real-time interaction

## Setup

### Prerequisites

1. **Ollama** (for local LLM):
   ```bash
   # Install Ollama from https://ollama.ai
   # Or use homebrew:
   brew install ollama
   
   # Start Ollama service
   ollama serve
   
   # Pull a model (recommended)
   ollama pull llama3.2
   # Or for better code understanding:
   ollama pull codellama
   ```

2. **Node.js** (>=22) and **pnpm**

### Installation

```bash
# Install dependencies (from repo root)
pnpm install

# Copy environment file
cd docs
cp .env.example .env

# Edit .env if needed to change model or Ollama URL
```

### Running

```bash
# From the docs directory
pnpm serve

# Or from repo root
pnpm --filter remix-the-docs run serve
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## Using the AI Chatbot

1. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open the chat modal
2. Type your question about Remix
3. The AI will search through docs, source code, and demos to provide context-aware answers
4. Press `Escape` to close the chat

### Example Questions

- "How do I create a cookie?"
- "What middleware does Remix provide?"
- "Show me an example of using sessions"
- "How does routing work in Remix?"

## Configuration

Edit `.env` to configure the LLM provider:

### Ollama (Local)
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

Available models:
- `llama3.2` - Good general purpose model
- `codellama` - Better for code-related questions
- `mistral` - Alternative general purpose model

### OpenAI (Future)
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4
```

### Anthropic (Future)
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_MODEL=claude-3-sonnet
```

Note: OpenAI and Anthropic providers are stubs and need implementation.

## Architecture

- **Content Indexer** (`lib/content-indexer.ts`): Discovers and indexes all markdown docs, TypeScript source files, and demo applications
- **LLM Providers** (`lib/llm/`): Abstraction layer supporting multiple LLM providers (Ollama, OpenAI, Anthropic)
- **Chat Handler** (`lib/chat-handler.ts`): Handles chat requests, searches content, and streams responses
- **Chat Modal** (`router.tsx`, `public/chat.css`, `public/chat-client.js`): UI and client-side logic

## Development

### Generating Documentation

```bash
# Generate API docs from TypeDoc comments
pnpm docs
```

### Building for Production

The docs can be pre-rendered for static hosting:

```bash
pnpm prerender
pnpm prerender:serve
```

Note: The chatbot requires a running server and cannot be used with static pre-rendered docs.

## Troubleshooting

### "Cannot connect to Ollama"

Make sure Ollama is running:
```bash
ollama serve
```

### "Model not found"

Pull the model first:
```bash
ollama pull llama3.2
```

### "Content index is empty"

Make sure you've generated the docs first:
```bash
pnpm docs
```

The content indexer needs the `docs/api/` directory to exist with markdown files.
