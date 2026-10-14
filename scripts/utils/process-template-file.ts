import { formatWithOxfmt } from './format.ts'

const TEMPLATE_REMOVE_BLOCK_PATTERN =
  /\/\*\s*remix-template:remove-start\b[\s\S]*?\*\/[\s\S]*?\/\*\s*remix-template:remove-end\s*\*\//g
const TEMPLATE_REMOVE_MARKER_PATTERN = /\/\*\s*remix-template:remove-(?:start|end)\b[\s\S]*?\*\//g
const TEMPLATE_DIRECTIVE_PATTERN = /\/\*\s*remix-template:([a-z-]+)\b[\s\S]*?\*\//g
const TEMPLATE_DIRECTIVE_NAMES = new Set(['remove-start', 'remove-end'])

export async function processTemplateFile(content: string, filePath: string): Promise<string> {
  validateTemplateDirectives(content)

  let processed = content.replace(TEMPLATE_REMOVE_BLOCK_PATTERN, '')
  let remainingMarker = processed.match(TEMPLATE_REMOVE_MARKER_PATTERN)?.[0]
  if (remainingMarker) {
    throw new Error(`Unmatched template remove marker: ${remainingMarker}`)
  }

  if (processed === content) {
    return processed
  }

  processed = await formatTemplateFile(filePath, processed)

  return processed
}

async function formatTemplateFile(filePath: string, content: string): Promise<string> {
  try {
    return await formatWithOxfmt(filePath, content)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unsupported file type: ')) {
      return content
    }
    throw error
  }
}

function validateTemplateDirectives(content: string): void {
  for (let match of content.matchAll(TEMPLATE_DIRECTIVE_PATTERN)) {
    let directive = match[1]
    if (directive != null && !TEMPLATE_DIRECTIVE_NAMES.has(directive)) {
      throw new Error(`Unknown template directive: ${match[0]}`)
    }
  }
}
