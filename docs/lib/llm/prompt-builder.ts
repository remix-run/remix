import type { IndexedContent } from '../content-indexer.ts'
import type { ChatMessage } from './provider.ts'

export function buildPrompt(
  userQuery: string,
  context: IndexedContent[],
  history: ChatMessage[] = [],
): ChatMessage[] {
  let systemMessage: ChatMessage = {
    role: 'system',
    content: `You are a helpful AI assistant for the Remix framework documentation. Your role is to help developers understand and use Remix by answering questions about the framework.

When answering questions:
- Be concise and accurate
- Provide code examples when relevant
- Reference specific functions, classes, or files when appropriate
- If you're not sure about something, say so
- Format code using markdown code blocks

You have access to:
- Official Remix documentation
- Source code from the Remix packages
- Example implementations from demo applications`,
  }

  let contextMessage: ChatMessage = {
    role: 'system',
    content: buildContextContent(context),
  }

  let userMessage: ChatMessage = {
    role: 'user',
    content: userQuery,
  }

  // Build message array: system + context + history + current question
  return [systemMessage, contextMessage, ...history, userMessage]
}

function buildContextContent(context: IndexedContent[]): string {
  if (context.length === 0) {
    return 'No specific context found for this query. Answer based on your general knowledge of Remix.'
  }

  let contextParts = ['Here is relevant context from the Remix codebase:\n']

  for (let item of context) {
    let relativePath = item.path.replace(/^.*\/remix\//, '')
    contextParts.push(`\n[File: ${relativePath}]`)

    if (item.type === 'doc') {
      // For docs, include the full markdown content (truncated if too long)
      let content = item.content
      if (content.length > 2000) {
        content = content.slice(0, 2000) + '\n... (truncated)'
      }
      contextParts.push(content)
    } else {
      // For source/demo files, show exports and a snippet
      if (item.exports && item.exports.length > 0) {
        contextParts.push(`Exports: ${item.exports.join(', ')}`)
      }

      let content = item.content
      if (content.length > 1000) {
        content = content.slice(0, 1000) + '\n... (truncated)'
      }
      contextParts.push(content)
    }
  }

  return contextParts.join('\n')
}
