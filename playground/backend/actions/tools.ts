import { tool } from 'ai'
import { z } from 'zod'

const replaceEditSchema = z.object({
  oldText: z
    .string()
    .describe(
      'Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call.',
    ),
  newText: z.string().describe('Replacement text for this targeted edit.'),
})

const editSchema = z.object({
  path: z.string().describe('Path to the file to edit (relative or absolute)'),
  edits: z
    .array(replaceEditSchema)
    .describe(
      'One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits. If two changes touch the same block or nearby lines, merge them into one edit instead.',
    ),
})

const listSchema = z.object({
  paths: z
    .array(z.string())
    .describe('Paths to the directories to list (relative or absolute). Provide one or more.'),
  depth: z
    .number()
    .describe(
      'How many levels of subdirectories to include. 0 means only the specified directory, 1 includes its immediate subdirectories, etc.',
    ),
})

const readSchema = z.object({
  paths: z
    .array(z.string())
    .describe('Paths to the files to read (relative or absolute). Provide one or more.'),
})

const writeSchema = z.object({
  path: z.string().describe('Path to the file to write (relative or absolute)'),
  content: z.string().describe('Content to write to the file'),
})

export const tools = {
  edit: tool({
    description:
      'Edit a single file using exact text replacement. Every edits[].oldText must match a unique, non-overlapping region of the original file. If two changes affect the same block or nearby lines, merge them into one edit instead of emitting overlapping edits. Do not include large unchanged regions just to connect distant changes.',
    inputSchema: editSchema,
  }),
  list: tool({
    description:
      'List files in one or more directories. Pass an array of paths to list several at once. Use depth to include subdirectories (depth=0 for just the specified directory, depth=1 to include immediate subdirectories, etc).',
    inputSchema: listSchema,
  }),
  read: tool({
    description:
      'Read the contents of one or more files. Pass an array of paths to read several at once. Supports text files and images (jpg, png, gif, webp). Images are sent as attachments. For text files, output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.',
    inputSchema: readSchema,
  }),
  write: tool({
    description:
      "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
    inputSchema: writeSchema,
  }),
}
