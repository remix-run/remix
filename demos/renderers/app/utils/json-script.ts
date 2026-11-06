/**
 * Serializes a value for an inline `<script type="application/json">`. `<` is escaped so
 * user-provided text can never close the script tag early.
 */
export function serializeJsonScript(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}
