import type { AuthFormErrors } from './pages.tsx'

export function issuesToErrors(
  issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>,
): AuthFormErrors {
  return issues.reduce<AuthFormErrors>((errors, issue) => {
    let field = issue.path?.[0]

    if (field === 'username' || field === 'password') {
      errors[field] = issue.message
    } else {
      errors.form = issue.message
    }

    return errors
  }, {})
}
