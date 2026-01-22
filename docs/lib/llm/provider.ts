export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatOptions = {
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface LLMProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>
  streamChat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ReadableStream<Uint8Array>>
}

export async function createLLMProvider(provider?: string): Promise<LLMProvider> {
  let providerName = provider || process.env.LLM_PROVIDER || 'ollama'

  switch (providerName.toLowerCase()) {
    case 'ollama':
      // Dynamic import to avoid loading unnecessary dependencies
      return createOllamaProvider()
    default:
      throw new Error(`Unknown LLM provider: ${providerName}`)
  }
}

async function createOllamaProvider(): Promise<LLMProvider> {
  let { OllamaProvider } = await import('./ollama-provider.ts')
  return new OllamaProvider()
}
