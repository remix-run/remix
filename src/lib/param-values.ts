export function quote(value: string): string {
  if (value.includes('"') || value.includes(";") || value.includes(" ")) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

export function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}
