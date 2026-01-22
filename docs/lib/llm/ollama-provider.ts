import { Ollama } from 'ollama'
import type { ChatMessage, ChatOptions, LLMProvider } from './provider.ts'

export class OllamaProvider implements LLMProvider {
  #client: Ollama
  #model: string

  constructor() {
    let baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    this.#model = process.env.OLLAMA_MODEL || 'llama3.2'
    this.#client = new Ollama({ host: baseUrl })
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    let response = await this.#client.chat({
      model: this.#model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      options: {
        temperature: options?.temperature,
        num_predict: options?.maxTokens,
      },
    })

    return response.message.content
  }

  async streamChat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ReadableStream<Uint8Array>> {
    let stream = await this.#client.chat({
      model: this.#model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
      options: {
        temperature: options?.temperature,
        num_predict: options?.maxTokens,
      },
    })

    // Convert Ollama stream to ReadableStream
    return new ReadableStream({
      async start(controller) {
        try {
          for await (let chunk of stream) {
            if (chunk.message?.content) {
              // Send as SSE format
              let data = JSON.stringify({ token: chunk.message.content })
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`))
            }

            if (chunk.done) {
              let done = JSON.stringify({ done: true })
              controller.enqueue(new TextEncoder().encode(`data: ${done}\n\n`))
              controller.close()
            }
          }
        } catch (error) {
          controller.error(error)
        }
      },
    })
  }
}
