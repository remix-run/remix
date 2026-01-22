import { getContentIndex, searchContent } from './content-indexer.ts'
import { createLLMProvider } from './llm/provider.ts'
import { buildPrompt } from './llm/prompt-builder.ts'
import type { ChatMessage } from './llm/provider.ts'

export type ChatRequest = {
  message: string
  history?: ChatMessage[]
}

export async function handleChatRequest(request: Request): Promise<Response> {
  // Parse request body
  let body: any
  try {
    body = await request.json()
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.message || typeof body.message !== 'string') {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let chatRequest: ChatRequest = {
    message: body.message,
    history: body.history || [],
  }

  try {
    // Get content index and search for relevant context
    let index = await getContentIndex()
    console.log(
      `Content index loaded: ${index.docs.length} docs, ${index.source.length} source files, ${index.demos.length} demo files`,
    )

    let relevantContent = searchContent(index, chatRequest.message, 10)
    console.log(
      `Found ${relevantContent.length} relevant content items for query: "${chatRequest.message}"`,
    )

    // Build prompt with context
    let messages = buildPrompt(chatRequest.message, relevantContent, chatRequest.history || [])

    // Get LLM provider and stream response
    let provider = await createLLMProvider()
    let stream = await provider.streamChat(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    })

    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
