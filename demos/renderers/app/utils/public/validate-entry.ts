export const MAX_MESSAGE_LENGTH = 140

export interface EntryValues {
  name: string
  message: string
}

export interface EntryErrors {
  name?: string
  message?: string
}

// Shared by the server action and the hydrated form so both agree on what is valid.
export function validateEntry(values: EntryValues): EntryErrors {
  let errors: EntryErrors = {}

  if (values.name.trim() === '') {
    errors.name = 'Please tell us your name.'
  }

  if (values.message.trim() === '') {
    errors.message = 'Please write a message.'
  } else if (values.message.length > MAX_MESSAGE_LENGTH) {
    errors.message = `Keep it under ${MAX_MESSAGE_LENGTH} characters.`
  }

  return errors
}

export function hasErrors(errors: EntryErrors): boolean {
  return errors.name !== undefined || errors.message !== undefined
}
