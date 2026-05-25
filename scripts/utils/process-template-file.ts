import * as prettier from 'prettier'

const TEMPLATE_REMOVE_BLOCK_PATTERN =
  /\/\*\s*remix-template:remove-start\b[\s\S]*?\*\/[\s\S]*?\/\*\s*remix-template:remove-end\s*\*\//g
const TEMPLATE_REMOVE_MARKER_PATTERN = /\/\*\s*remix-template:remove-(?:start|end)\b[\s\S]*?\*\//g

export async function processTemplateFile(content: string, filePath: string): Promise<string> {
  let processed = content.replace(TEMPLATE_REMOVE_BLOCK_PATTERN, '')
  let remainingMarker = processed.match(TEMPLATE_REMOVE_MARKER_PATTERN)?.[0]
  if (remainingMarker) {
    throw new Error(`Unmatched template remove marker: ${remainingMarker}`)
  }

  if (processed === content) {
    return processed
  }

  let fileInfo = await prettier.getFileInfo(filePath)
  if (fileInfo.inferredParser) {
    let config = await prettier.resolveConfig(filePath)
    processed = await prettier.format(processed, { ...config, filepath: filePath })
  }

  return processed
}
