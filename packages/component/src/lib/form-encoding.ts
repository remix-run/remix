/**
 * Encodes form entries as `application/x-www-form-urlencoded` search params, matching how the
 * browser serializes a form submission.
 *
 * @param formData Form entries to encode.
 * @returns The encoded search params.
 */
export function formDataToSearchParams(formData: FormData): URLSearchParams {
  let params = new URLSearchParams()
  for (let [name, value] of formData) {
    params.append(...normalizeEntry(name, value))
  }
  return params
}

/**
 * Encodes form entries as a `text/plain` form submission body.
 *
 * @param formData Form entries to encode.
 * @returns The encoded body text.
 */
export function formDataToPlainText(formData: FormData): string {
  let body = ''
  for (let [name, value] of formData) {
    let [normalizedName, normalizedValue] = normalizeEntry(name, value)
    body += `${normalizedName}=${normalizedValue}\r\n`
  }
  return body
}

// Browsers submit File entries by filename and normalize line breaks to CRLF in both encodings.
function normalizeEntry(name: string, value: FormDataEntryValue): [string, string] {
  return [
    normalizeLineBreaks(name),
    normalizeLineBreaks(typeof value === 'string' ? value : value.name),
  ]
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}
