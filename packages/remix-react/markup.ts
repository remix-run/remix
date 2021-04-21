export interface SafeHtml {
  __html: string;
}

export function createHtml(html: string): SafeHtml {
  return { __html: html };
}
