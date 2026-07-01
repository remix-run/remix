import { object, parseSafe, string, type Check } from 'remix/data-schema'

import type { ChapterMetadata, MarkdownOptions } from './types.ts'

const nonEmpty: Check<string> = {
  check(value) {
    return value.trim() !== ''
  },
  code: 'string.non_empty',
  message: 'Expected a non-empty string',
}

const frontmatterSchema = object({
  title: string().pipe(nonEmpty),
  description: string().pipe(nonEmpty),
})

export function readChapterMetadata(
  attributes: Record<string, unknown>,
  options: MarkdownOptions,
): ChapterMetadata {
  let result = parseSafe(frontmatterSchema, attributes)
  if (!result.success) {
    let issue = result.issues[0]
    let key = issue.path?.[0]
    let location = options.filePath ? `${options.filePath}:1` : 'Markdown:1'
    let field = typeof key === 'string' ? `\`${key}\`` : 'frontmatter'
    throw new Error(`${location}: Invalid frontmatter: Expected ${field} to be a non-empty string`)
  }

  return {
    chapter: options.chapter,
    title: result.value.title,
    description: result.value.description,
  }
}
