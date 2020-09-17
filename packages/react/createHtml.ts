interface SafeHtml {
  __html: string;
}

export default function createHtml(html: string): SafeHtml {
  return { __html: html };
}
