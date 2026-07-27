import { format, type FormatConfig } from 'oxfmt'
import oxfmtConfig from '../../../oxfmt.config.ts'

export async function formatWithOxfmt(
  filePath: string,
  content: string,
  options?: FormatConfig,
): Promise<string> {
  let result = await format(filePath, content, {
    ...oxfmtConfig,
    ...options,
  })

  if (result.errors.length > 0) {
    throw new Error(formatOxfmtErrors(result.errors))
  }

  return result.code
}

function formatOxfmtErrors(errors: Awaited<ReturnType<typeof format>>['errors']): string {
  return errors.map((error) => error.message).join('\n')
}
