import type { ChatMessage, ChatOptions, LLMProvider } from './provider.ts'

export class OpenAIProvider implements LLMProvider {
  constructor() {
    // TODO: Initialize OpenAI client when implemented
    throw new Error(
      'OpenAI provider not yet implemented. Set LLM_PROVIDER=ollama to use Ollama instead.',
    )
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    throw new Error('OpenAI provider not yet implemented')
  }

  async streamChat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ReadableStream<Uint8Array>> {
    throw new Error('OpenAI provider not yet implemented')
  }
}
