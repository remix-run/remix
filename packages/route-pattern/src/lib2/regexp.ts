/** Polyfill for `RegExp.escape` */
export const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
