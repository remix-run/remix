export function parseParams(
  input: string,
  delimiter: ';' | ',' = ';',
): [string, string | undefined][] {
  let regex = /(?:^|;)\s*([^=;\s]+)(\s*=\s*(?:"((?:[^"\\]|\\.)*)"|((?:[^;]|\\\;)+))?)?/g;
  if (delimiter === ',') {
    regex = /(?:^|,)\s*([^=,\s]+)(\s*=\s*(?:"((?:[^"\\]|\\.)*)"|((?:[^,]|\\\,)+))?)?/g;
  }
  let params: [string, string | undefined][] = [];

  let match;
  while ((match = regex.exec(input)) !== null) {
    let key = match[1].trim();

    let value: string | undefined;
    if (match[2]) {
      value = (match[3] || match[4] || '').replace(/\\(.)/g, '$1').trim();
    }

    params.push([key, value]);
  }

  return params;
}

export function quote(value: string): string {
  if (value.includes('"') || value.includes(';') || value.includes(' ')) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}
