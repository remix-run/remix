import { normalizeOptionalText } from '../../data/schema.ts'

export function getIssueMessage(issues: ReadonlyArray<{ message: string }>): string {
  return issues[0]?.message ?? 'Please review the form and try again.'
}

export function readSignupValues(formData: FormData): { name?: string; email?: string } {
  return {
    name: normalizeOptionalText(readField(formData, 'name') ?? ''),
    email: normalizeOptionalText(readField(formData, 'email') ?? ''),
  }
}

export function readField(formData: FormData, name: string): string | undefined {
  let value = formData.get(name)
  return typeof value === 'string' ? value : undefined
}
